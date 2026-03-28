import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Bot from '../models/Bot';
import User, { IUser } from '../models/User';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { createLogger } from '../config/logger';

const router = Router();
const log = createLogger('bots');

function isValidObjectId(id: string | string[]): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    let bots;
    if (user.role === 'admin') {
      bots = await Bot.find();
    } else if (user.subscriptionId) {
      bots = await Bot.find({ availableToSubscriptionIds: user.subscriptionId });
    } else {
      bots = await Bot.find({ availableToSubscriptionIds: { $size: 0 } });
    }
    res.json({ bots });
  } catch (error) {
    log.error({ err: error }, 'Error fetching bots');
    res.status(500).json({ message: 'Error fetching bots' });
  }
});

router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid bot ID' });
      return;
    }
    const bot = await Bot.findById(req.params.id);
    if (!bot) {
      res.status(404).json({ message: 'Bot not found' });
      return;
    }
    res.json({ bot });
  } catch (error) {
    log.error({ err: error }, 'Error fetching bot');
    res.status(500).json({ message: 'Error fetching bot' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, personality, systemPrompt, avatar, availableToSubscriptionIds, llmConfigId } = req.body as {
      name: string;
      description?: string;
      personality?: string;
      systemPrompt: string;
      avatar?: string;
      availableToSubscriptionIds?: string[];
      llmConfigId?: string;
    };
    if (!name || !systemPrompt) {
      res.status(400).json({ message: 'Name and systemPrompt are required' });
      return;
    }
    const bot = new Bot({ name, description, personality, systemPrompt, avatar, availableToSubscriptionIds, llmConfigId: llmConfigId || undefined });
    await bot.save();
    log.info({ botId: bot._id, name }, 'Bot created');
    res.status(201).json({ bot, message: 'Bot created successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error creating bot');
    res.status(500).json({ message: 'Error creating bot' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid bot ID' });
      return;
    }
    const { name, description, personality, systemPrompt, avatar, availableToSubscriptionIds, llmConfigId } = req.body as {
      name?: string;
      description?: string;
      personality?: string;
      systemPrompt?: string;
      avatar?: string;
      availableToSubscriptionIds?: string[];
      llmConfigId?: string;
    };
    const bot = await Bot.findByIdAndUpdate(
      req.params.id,
      { name, description, personality, systemPrompt, avatar, availableToSubscriptionIds, llmConfigId: llmConfigId || undefined },
      { new: true, runValidators: true },
    );
    if (!bot) {
      res.status(404).json({ message: 'Bot not found' });
      return;
    }
    res.json({ bot, message: 'Bot updated successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error updating bot');
    res.status(500).json({ message: 'Error updating bot' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid bot ID' });
      return;
    }
    const bot = await Bot.findByIdAndDelete(req.params.id);
    if (!bot) {
      res.status(404).json({ message: 'Bot not found' });
      return;
    }
    log.info({ botId: req.params.id }, 'Bot deleted');
    res.json({ message: 'Bot deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting bot');
    res.status(500).json({ message: 'Error deleting bot' });
  }
});

export default router;
