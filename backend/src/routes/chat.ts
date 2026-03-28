import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import ChatSession from '../models/ChatSession';
import Message from '../models/Message';
import User, { IUser } from '../models/User';
import ClientMemory from '../models/ClientMemory';
import { authenticateToken } from '../middleware/auth';
import { createLogger } from '../config/logger';

const router = Router();
const log = createLogger('chat');

function isValidObjectId(id: string | string[]): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

const VALID_ROLES = ['user', 'assistant', 'system'] as const;

router.get('/sessions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await ChatSession.find({ userId: (req.user as IUser)._id })
      .populate('botId', 'name avatar')
      .sort({ updatedAt: -1 });
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
    const session = new ChatSession({
      userId: user._id,
      botId,
      lockedLanguageCode: user.languageCode || 'en-us',
    });
    await session.save();
    await session.populate('botId', 'name avatar');
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

export default router;
