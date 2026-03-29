/**
 * chat.ts — Chat session & client memory routes.
 *
 * Sessions: list, create, get messages, post message, delete.
 * Client Memory: read per-bot, list all, delete key, delete all.
 *
 * All routes require authentication; users can only access their own data.
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import ChatSession from '../models/ChatSession';
import Message from '../models/Message';
import User, { IUser } from '../models/User';
import ClientMemory from '../models/ClientMemory';
import Bot from '../models/Bot';
import BotLocale from '../models/BotLocale';
import { authenticateToken } from '../middleware/auth';
import { createLogger } from '../config/logger';

/** Enrich populated sessions/memories with locale-resolved bot name. */
async function resolveBotNames(
  items: Array<{ botId?: { _id: unknown; avatar?: string } | unknown }>,
  languageCode: string,
): Promise<void> {
  const normalized = languageCode.toLowerCase().trim();
  // Collect unique bot IDs from populated objects
  const botIdSet = new Set<string>();
  for (const item of items) {
    if (item.botId && typeof item.botId === 'object' && '_id' in (item.botId as Record<string, unknown>)) {
      botIdSet.add(String((item.botId as Record<string, unknown>)._id));
    }
  }
  if (botIdSet.size === 0) return;

  const botIds = [...botIdSet];
  const locales = await BotLocale.find({
    botId: { $in: botIds },
    languageCode: { $in: [normalized, 'en-us'] },
  }).lean();

  const nameMap = new Map<string, string>();
  // Prefer exact match, fall back to en-us
  for (const loc of locales) {
    const id = loc.botId.toString();
    if (loc.languageCode === normalized) {
      nameMap.set(id, loc.name || '');
    } else if (!nameMap.has(id)) {
      nameMap.set(id, loc.name || '');
    }
  }

  for (const item of items) {
    if (item.botId && typeof item.botId === 'object' && '_id' in (item.botId as Record<string, unknown>)) {
      const botObj = item.botId as Record<string, unknown>;
      botObj.name = nameMap.get(String(botObj._id)) || '';
    }
  }
}

const router = Router();
const log = createLogger('chat');

function isValidObjectId(id: string | string[]): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

const VALID_ROLES = ['user', 'assistant', 'system'] as const;

router.get('/sessions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    const sessions = await ChatSession.find({ userId: user._id })
      .populate('botId', 'avatar')
      .sort({ updatedAt: -1 });
    await resolveBotNames(sessions as unknown as Array<{ botId?: Record<string, unknown> }>, user.languageCode || 'en-us');
    res.json({ sessions });
  } catch (error) {
    log.error({ err: error }, 'Error fetching chat sessions');
    res.status(500).json({ message: 'Error fetching chat sessions' });
  }
});

router.post('/sessions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { botId } = req.body as { botId: string };
    if (!botId || !isValidObjectId(botId)) {
      res.status(400).json({ message: 'Valid botId is required' });
      return;
    }
    const user = await User.findById((req.user as IUser)._id);
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }
    // Verify bot exists and user is entitled to it
    const bot = await Bot.findById(botId);
    if (!bot) {
      res.status(404).json({ message: 'Bot not found' });
      return;
    }
    if (user.role !== 'admin') {
      const subIds = bot.availableToSubscriptionIds.map((id) => id.toString());
      if (subIds.length > 0 && (!user.subscriptionId || !subIds.includes(user.subscriptionId.toString()))) {
        res.status(403).json({ message: 'You do not have access to this bot' });
        return;
      }
    }
    const session = new ChatSession({
      userId: user._id,
      botId,
      lockedLanguageCode: user.languageCode || 'en-us',
    });
    await session.save();
    await session.populate('botId', 'avatar');
    const user2 = req.user as IUser;
    await resolveBotNames([session as unknown as { botId?: Record<string, unknown> }], user2.languageCode || 'en-us');
    log.info({ sessionId: session._id, botId, lockedLanguageCode: session.lockedLanguageCode }, 'Chat session created');
    res.status(201).json({ session, message: 'Chat session created' });
  } catch (error) {
    log.error({ err: error }, 'Error creating chat session');
    res.status(500).json({ message: 'Error creating chat session' });
  }
});

router.get('/sessions/:id/messages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }
    // Verify the session belongs to the requesting user
    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: (req.user as IUser)._id,
    });
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }
    const messages = await Message.find({ sessionId: req.params.id }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (error) {
    log.error({ err: error }, 'Error fetching messages');
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

router.post('/sessions/:id/messages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }
    const { content, role } = req.body as { content: string; role?: typeof VALID_ROLES[number] };
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ message: 'Content is required' });
      return;
    }
    if (role && !VALID_ROLES.includes(role)) {
      res.status(400).json({ message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }
    // Verify session ownership
    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: (req.user as IUser)._id,
    });
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }
    const message = new Message({
      sessionId: req.params.id,
      role: role ?? 'user',
      content: content.trim(),
    });
    await message.save();
    session.updatedAt = new Date();
    await session.save();
    res.status(201).json({ message, created: true });
  } catch (error) {
    log.error({ err: error }, 'Error sending message');
    res.status(500).json({ message: 'Error sending message' });
  }
});

router.delete('/sessions/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }
    // Only allow deleting own sessions
    const session = await ChatSession.findOneAndDelete({
      _id: req.params.id,
      userId: (req.user as IUser)._id,
    });
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }
    await Message.deleteMany({ sessionId: req.params.id });
    log.info({ sessionId: req.params.id }, 'Chat session deleted');
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting session');
    res.status(500).json({ message: 'Error deleting session' });
  }
});

// ---------------------------------------------------------------------------
// Client memory — read own memory for a specific bot
// ---------------------------------------------------------------------------
router.get('/memory/:botId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.botId)) {
      res.status(400).json({ message: 'Invalid bot ID' });
      return;
    }
    const memory = await ClientMemory.findOne({
      userId: (req.user as IUser)._id,
      botId: req.params.botId,
    }).lean();
    res.json({ memory: memory ?? null });
  } catch (error) {
    log.error({ err: error }, 'Error fetching client memory');
    res.status(500).json({ message: 'Error fetching client memory' });
  }
});

// ---------------------------------------------------------------------------
// Client memory — list ALL memories for the current user (grouped by bot)
// ---------------------------------------------------------------------------
router.get('/memories', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user3 = req.user as IUser;
    const memories = await ClientMemory.find({ userId: user3._id })
      .populate<{ botId: { _id: string; name?: string; avatar?: string } }>('botId', 'avatar')
      .lean();
    await resolveBotNames(memories as unknown as Array<{ botId?: Record<string, unknown> }>, user3.languageCode || 'en-us');
    res.json({ memories });
  } catch (error) {
    log.error({ err: error }, 'Error fetching all client memories');
    res.status(500).json({ message: 'Error fetching memories' });
  }
});

// ---------------------------------------------------------------------------
// Client memory — delete a single key from a specific bot's memory
// ---------------------------------------------------------------------------
router.delete('/memory/:botId/:key', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.botId)) {
      res.status(400).json({ message: 'Invalid bot ID' });
      return;
    }
    const key = req.params.key as string;
    if (!key || typeof key !== 'string') {
      res.status(400).json({ message: 'Key is required' });
      return;
    }
    const record = await ClientMemory.findOne({
      userId: (req.user as IUser)._id,
      botId: req.params.botId,
    });
    if (!record) {
      res.status(404).json({ message: 'Memory not found' });
      return;
    }
    const data = record.data as Record<string, unknown>;
    delete data[key];
    record.data = data;
    record.markModified('data');
    await record.save();
    log.info({ botId: req.params.botId, key }, 'Client memory key deleted');
    res.json({ message: 'Memory key deleted' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting memory key');
    res.status(500).json({ message: 'Error deleting memory key' });
  }
});

// ---------------------------------------------------------------------------
// Client memory — delete ALL memories for the current user
// ---------------------------------------------------------------------------
router.delete('/memories', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ClientMemory.deleteMany({ userId: (req.user as IUser)._id });
    log.info({ deletedCount: result.deletedCount }, 'All client memories deleted');
    res.json({ message: 'All memories deleted', deletedCount: result.deletedCount });
  } catch (error) {
    log.error({ err: error }, 'Error deleting all memories');
    res.status(500).json({ message: 'Error deleting memories' });
  }
});

export default router;
