import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Bot from '../models/Bot';
import { authenticateToken } from '../middleware/auth';
import { createLogger } from '../config/logger';

const router = Router();
const log = createLogger('playground');

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

router.get('/bots', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const bots = await Bot.find({}, 'name description avatar');
    res.json({ bots });
  } catch (error) {
    log.error({ err: error }, 'Error fetching bots');
    res.status(500).json({ message: 'Error fetching bots' });
  }
});

router.post('/sessions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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
    res.json({
      message: 'Playground session started',
      bot: { id: bot._id, name: bot.name, description: bot.description, avatar: bot.avatar },
    });
  } catch (error) {
    log.error({ err: error }, 'Error starting playground session');
    res.status(500).json({ message: 'Error starting playground session' });
  }
});

router.post('/messages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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
