/**
 * bots.ts — Bot CRUD routes.
 *
 * Localizable fields (name, description, personality, systemPrompt) live in
 * BotLocale — the Bot document only stores technical fields (avatar, llmConfigId,
 * availableToSubscriptionIds).  GET routes resolve the user's locale and merge
 * name / description into the response so consumers get a flat object.
 *
 * - GET  / — list bots visible to the authenticated user (locale-resolved)
 * - GET  /:id — single bot detail (locale-resolved)
 * - POST / — create (admin only, technical fields only)
 * - PUT  /:id — update (admin only, technical fields only)
 * - DELETE /:id — delete (admin only, cascades BotLocale)
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Bot from '../models/Bot';
import BotLocale from '../models/BotLocale';
import User, { IUser } from '../models/User';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { createLogger } from '../config/logger';

const router = Router();
const log = createLogger('bots');

function isValidObjectId(id: string | string[]): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

/**
 * Merge locale-resolved name/description into a flat bot object for API consumers.
 * Falls back from user language → en-us → empty strings.
 */
async function enrichBotsWithLocale(
  bots: InstanceType<typeof Bot>[],
  languageCode: string,
): Promise<Record<string, unknown>[]> {
  if (bots.length === 0) return [];

  const botIds = bots.map((b) => b._id);
  const normalizedCode = languageCode.toLowerCase().trim();

  // Fetch all locales for the requested language + en-us fallback in one query
  const locales = await BotLocale.find({
    botId: { $in: botIds },
    languageCode: { $in: [normalizedCode, 'en-us'] },
  }).lean();

  // Build lookup: botId -> { [languageCode]: locale }
  const localeMap = new Map<string, Map<string, typeof locales[0]>>();
  for (const loc of locales) {
    const key = loc.botId.toString();
    if (!localeMap.has(key)) localeMap.set(key, new Map());
    localeMap.get(key)!.set(loc.languageCode, loc);
  }

  return bots.map((bot) => {
    const obj = bot.toObject();
    const byLang = localeMap.get(bot._id.toString());
    const locale = byLang?.get(normalizedCode) ?? byLang?.get('en-us');
    return {
      ...obj,
      name: locale?.name ?? '',
      description: locale?.description ?? '',
    };
  });
}

router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    const languageCode = user.languageCode || 'en-us';
    let bots;
    if (user.role === 'admin') {
      bots = await Bot.find();
    } else if (user.subscriptionId) {
      bots = await Bot.find({ availableToSubscriptionIds: user.subscriptionId });
    } else {
      bots = await Bot.find({ availableToSubscriptionIds: { $size: 0 } });
    }
    const enriched = await enrichBotsWithLocale(bots, languageCode);
    res.json({ bots: enriched });
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
    const user = req.user as IUser;
    const [enriched] = await enrichBotsWithLocale([bot], user.languageCode || 'en-us');
    res.json({ bot: enriched });
  } catch (error) {
    log.error({ err: error }, 'Error fetching bot');
    res.status(500).json({ message: 'Error fetching bot' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { avatar, availableToSubscriptionIds, llmConfigId } = req.body as {
      avatar?: string;
      availableToSubscriptionIds?: string[];
      llmConfigId?: string;
    };
    const bot = new Bot({ avatar, availableToSubscriptionIds, llmConfigId: llmConfigId || undefined });
    await bot.save();
    log.info({ botId: bot._id }, 'Bot created');
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
    const { avatar, availableToSubscriptionIds, llmConfigId } = req.body as {
      avatar?: string;
      availableToSubscriptionIds?: string[];
      llmConfigId?: string;
    };
    const bot = await Bot.findByIdAndUpdate(
      req.params.id,
      { avatar, availableToSubscriptionIds, llmConfigId: llmConfigId || undefined },
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
    await BotLocale.deleteMany({ botId: req.params.id });
    log.info({ botId: req.params.id }, 'Bot deleted');
    res.json({ message: 'Bot deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting bot');
    res.status(500).json({ message: 'Error deleting bot' });
  }
});

export default router;
