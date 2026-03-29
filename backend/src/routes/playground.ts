/** playground.ts — Admin prompt playground routes for testing bot configurations. */
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Bot from '../models/Bot';
import BotLocale from '../models/BotLocale';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { createLogger } from '../config/logger';

const router = Router();
const log = createLogger('playground');

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

router.get('/bots', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const bots = await Bot.find({}, 'avatar');
    // Enrich with en-us locale names for admin playground
    const botIds = bots.map((b) => b._id);
    const locales = await BotLocale.find({ botId: { $in: botIds }, languageCode: 'en-us' }).lean();
    const nameMap = new Map<string, { name?: string; description?: string }>();
    for (const loc of locales) nameMap.set(loc.botId.toString(), { name: loc.name, description: loc.description });
    const enriched = bots.map((b) => {
      const obj = b.toObject();
      const loc = nameMap.get(b._id.toString());
      return { ...obj, name: loc?.name ?? '', description: loc?.description ?? '' };
    });
    res.json({ bots: enriched });
  } catch (error) {
    log.error({ err: error }, 'Error fetching bots');
    res.status(500).json({ message: 'Error fetching bots' });
  }
});

router.post('/sessions', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { botId } = req.body as { botId: string };
    if (!botId || !isValidObjectId(botId)) {
      res.status(400).json({ message: 'Valid botId is required' });
      return;
    }
    const bot = await Bot.findById(botId);
    if (!bot) {
      res.status(404).json({ message: 'Bot not found' });
      return;
    }
    const locale = await BotLocale.findOne({ botId, languageCode: 'en-us' }).lean();
    res.json({
      message: 'Playground session started',
      bot: { id: bot._id, name: locale?.name ?? '', description: locale?.description ?? '', avatar: bot.avatar },
    });
  } catch (error) {
    log.error({ err: error }, 'Error starting playground session');
    res.status(500).json({ message: 'Error starting playground session' });
  }
});

router.post('/messages', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { botId, message } = req.body as { botId: string; message: string };
    if (!botId || !isValidObjectId(botId) || !message || typeof message !== 'string') {
      res.status(400).json({ message: 'Valid botId and message are required' });
      return;
    }
    res.json({
      message: 'Message sent to bot',
      response: `This is a simulated response from ${botId}. In a real implementation, this would connect to an LLM.`,
      timestamp: new Date(),
    });
  } catch (error) {
    log.error({ err: error }, 'Error sending message');
    res.status(500).json({ message: 'Error sending message' });
  }
});

export default router;
