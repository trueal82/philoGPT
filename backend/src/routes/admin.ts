/**
 * admin.ts — Admin-only REST routes.
 *
 * All endpoints require `authenticateToken` + `requireAdmin` middleware.
 * Covers CRUD for: Users, LLM Configs, System Prompt, Bots, Languages,
 * User Groups, Subscriptions, Bot Locales, Sessions, Tools, Client Memories.
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Bot from '../models/Bot';
import LLMConfig from '../models/LLMConfig';
import SystemPrompt from '../models/SystemPrompt';
import Language from '../models/Language';
import UserGroup from '../models/UserGroup';
import Subscription from '../models/Subscription';
import BotLocale from '../models/BotLocale';
import ChatSession from '../models/ChatSession';
import Message from '../models/Message';
import Tool from '../models/Tool';
import ClientMemory from '../models/ClientMemory';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { createLogger } from '../config/logger';

const router = Router();
const log = createLogger('admin');

const VALID_ROLES = ['user', 'admin'] as const;
const VALID_PROVIDERS = ['openai', 'ollama', 'huggingface', 'custom'] as const;

function isValidObjectId(id: string | string[]): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
router.get('/users', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    log.debug({ count: users.length }, 'Fetched users');
    res.json({ users });
  } catch (error) {
    log.error({ err: error }, 'Error fetching users');
    res.status(500).json({ message: 'Error fetching users' });
  }
});

router.get('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }
    const user = await User.findById(req.params.id, '-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (error) {
    log.error({ err: error }, 'Error fetching user');
    res.status(500).json({ message: 'Error fetching user' });
  }
});

router.put('/users/:id/role', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }
    const { role } = req.body as { role: string };
    if (!role || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      res.status(400).json({ message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true, select: '-password' },
    );
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    log.info({ userId: req.params.id, role }, 'User role updated');
    res.json({ user, message: 'User role updated successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error updating user role');
    res.status(500).json({ message: 'Error updating user role' });
  }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    log.info({ userId: req.params.id }, 'User deleted');
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting user');
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Lock user
router.post('/users/:id/lock', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }
    const { reason } = req.body as { reason?: string };
    const update: Record<string, unknown> = { isLocked: true, lockedAt: new Date() };
    if (reason && typeof reason === 'string') {
      update.lockedReason = reason.slice(0, 500);
    }
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, select: '-password' });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    log.info({ userId: req.params.id, reason }, 'User locked');
    res.json({ user, message: 'User locked successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error locking user');
    res.status(500).json({ message: 'Error locking user' });
  }
});

// Unlock user
router.post('/users/:id/unlock', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isLocked: false, $unset: { lockedAt: 1, lockedReason: 1 } },
      { new: true, select: '-password' },
    );
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    log.info({ userId: req.params.id }, 'User unlocked');
    res.json({ user, message: 'User unlocked successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error unlocking user');
    res.status(500).json({ message: 'Error unlocking user' });
  }
});

// ---------------------------------------------------------------------------
// LLM Configs
// ---------------------------------------------------------------------------
router.get('/llm-configs', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const configs = await LLMConfig.find().sort({ createdAt: -1 });
    log.debug({ count: configs.length }, 'Fetched LLM configs');
    res.json({ configs });
  } catch (error) {
    log.error({ err: error }, 'Error fetching LLM configs');
    res.status(500).json({ message: 'Error fetching LLM configs' });
  }
});

router.post('/llm-configs', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, provider, apiKey, apiUrl, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, supportsTools } = req.body;
    if (!name || !provider || !VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ message: 'Name and a valid provider are required' });
      return;
    }
    const config = new LLMConfig({ name, provider, apiKey, apiUrl, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, supportsTools: !!supportsTools });
    await config.save();
    log.info({ configId: config._id, name, provider }, 'LLM config created');
    res.status(201).json({ config, message: 'LLM configuration created successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error creating LLM configuration');
    res.status(500).json({ message: 'Error creating LLM configuration' });
  }
});

router.put('/llm-configs/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid config ID' });
      return;
    }
    const { name, provider, apiKey, apiUrl, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, supportsTools } = req.body;
    const update: Record<string, unknown> = { name, provider, apiUrl, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty };
    if (apiKey) update.apiKey = apiKey;
    if (supportsTools !== undefined) update.supportsTools = !!supportsTools;
    const config = await LLMConfig.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true },
    );
    if (!config) {
      res.status(404).json({ message: 'LLM configuration not found' });
      return;
    }
    log.info({ configId: req.params.id }, 'LLM config updated');
    res.json({ config, message: 'LLM configuration updated successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error updating LLM configuration');
    res.status(500).json({ message: 'Error updating LLM configuration' });
  }
});

router.delete('/llm-configs/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid config ID' });
      return;
    }
    const config = await LLMConfig.findByIdAndDelete(req.params.id);
    if (!config) {
      res.status(404).json({ message: 'LLM configuration not found' });
      return;
    }
    log.info({ configId: req.params.id }, 'LLM config deleted');
    res.json({ message: 'LLM configuration deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting LLM configuration');
    res.status(500).json({ message: 'Error deleting LLM configuration' });
  }
});

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------
router.get('/system-prompt', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const prompt = await SystemPrompt.findOne({ isActive: true });
    res.json({ prompt });
  } catch (error) {
    log.error({ err: error }, 'Error fetching system prompt');
    res.status(500).json({ message: 'Error fetching system prompt' });
  }
});

router.put('/system-prompt', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { content } = req.body as { content: string };
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ message: 'Content is required' });
      return;
    }
    const prompt = await SystemPrompt.findOneAndUpdate(
      { isActive: true },
      { content: content.trim() },
      { new: true, runValidators: true },
    );
    if (!prompt) {
      res.status(404).json({ message: 'System prompt not found' });
      return;
    }
    log.info('System prompt updated');
    res.json({ prompt, message: 'System prompt updated successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error updating system prompt');
    res.status(500).json({ message: 'Error updating system prompt' });
  }
});

// Bots overview (for admin)
router.get('/bots', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const bots = await Bot.find().sort({ createdAt: -1 });
    res.json({ bots });
  } catch (error) {
    log.error({ err: error }, 'Error fetching bots');
    res.status(500).json({ message: 'Error fetching bots' });
  }
});

// ---------------------------------------------------------------------------
// Extended User update (languageCode, userGroupId, subscriptionId)
// ---------------------------------------------------------------------------
router.put('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }
    const { role, languageCode, userGroupId, subscriptionId } = req.body as {
      role?: string;
      languageCode?: string;
      userGroupId?: string | null;
      subscriptionId?: string | null;
    };

    const update: Record<string, unknown> = {};

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
        res.status(400).json({ message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
        return;
      }
      update.role = role;
    }
    if (languageCode !== undefined) {
      update.languageCode = languageCode.toLowerCase().trim();
    }
    if (userGroupId !== undefined) {
      if (userGroupId === null || userGroupId === '') {
        update.userGroupId = null;
      } else {
        if (!isValidObjectId(userGroupId)) {
          res.status(400).json({ message: 'Invalid userGroupId' });
          return;
        }
        update.userGroupId = userGroupId;
      }
    }
    if (subscriptionId !== undefined) {
      if (subscriptionId === null || subscriptionId === '') {
        update.subscriptionId = null;
      } else {
        if (!isValidObjectId(subscriptionId)) {
          res.status(400).json({ message: 'Invalid subscriptionId' });
          return;
        }
        update.subscriptionId = subscriptionId;
      }
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ message: 'No valid fields to update' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true, select: '-password' },
    );
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    log.info({ userId: req.params.id, update }, 'User updated');
    res.json({ user, message: 'User updated successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error updating user');
    res.status(500).json({ message: 'Error updating user' });
  }
});

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------
router.get('/languages', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const languages = await Language.find().sort({ sortOrder: 1, code: 1 });
    res.json({ languages });
  } catch (error) {
    log.error({ err: error }, 'Error fetching languages');
    res.status(500).json({ message: 'Error fetching languages' });
  }
});

router.post('/languages', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, nativeName, active, sortOrder } = req.body as {
      code: string; name: string; nativeName: string; active?: boolean; sortOrder?: number;
    };
    if (!code || !name || !nativeName) {
      res.status(400).json({ message: 'code, name, and nativeName are required' });
      return;
    }
    const language = new Language({ code, name, nativeName, active, sortOrder });
    await language.save();
    log.info({ code }, 'Language created');
    res.status(201).json({ language, message: 'Language created successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A language with this code already exists' });
      return;
    }
    log.error({ err: error }, 'Error creating language');
    res.status(500).json({ message: 'Error creating language' });
  }
});

router.put('/languages/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid language ID' });
      return;
    }
    const { code, name, nativeName, active, sortOrder } = req.body;
    const language = await Language.findByIdAndUpdate(
      req.params.id,
      { code, name, nativeName, active, sortOrder },
      { new: true, runValidators: true },
    );
    if (!language) {
      res.status(404).json({ message: 'Language not found' });
      return;
    }
    log.info({ languageId: req.params.id }, 'Language updated');
    res.json({ language, message: 'Language updated successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A language with this code already exists' });
      return;
    }
    log.error({ err: error }, 'Error updating language');
    res.status(500).json({ message: 'Error updating language' });
  }
});

router.delete('/languages/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid language ID' });
      return;
    }
    const language = await Language.findByIdAndDelete(req.params.id);
    if (!language) {
      res.status(404).json({ message: 'Language not found' });
      return;
    }
    log.info({ languageId: req.params.id }, 'Language deleted');
    res.json({ message: 'Language deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting language');
    res.status(500).json({ message: 'Error deleting language' });
  }
});

// ---------------------------------------------------------------------------
// User Groups
// ---------------------------------------------------------------------------
router.get('/user-groups', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const userGroups = await UserGroup.find().sort({ name: 1 });
    res.json({ userGroups });
  } catch (error) {
    log.error({ err: error }, 'Error fetching user groups');
    res.status(500).json({ message: 'Error fetching user groups' });
  }
});

router.post('/user-groups', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, active } = req.body as { name: string; description?: string; active?: boolean };
    if (!name) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }
    const userGroup = new UserGroup({ name, description, active });
    await userGroup.save();
    log.info({ name }, 'User group created');
    res.status(201).json({ userGroup, message: 'User group created successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A user group with this name already exists' });
      return;
    }
    log.error({ err: error }, 'Error creating user group');
    res.status(500).json({ message: 'Error creating user group' });
  }
});

router.put('/user-groups/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid user group ID' });
      return;
    }
    const { name, description, active } = req.body;
    const userGroup = await UserGroup.findByIdAndUpdate(
      req.params.id,
      { name, description, active },
      { new: true, runValidators: true },
    );
    if (!userGroup) {
      res.status(404).json({ message: 'User group not found' });
      return;
    }
    log.info({ userGroupId: req.params.id }, 'User group updated');
    res.json({ userGroup, message: 'User group updated successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A user group with this name already exists' });
      return;
    }
    log.error({ err: error }, 'Error updating user group');
    res.status(500).json({ message: 'Error updating user group' });
  }
});

router.delete('/user-groups/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid user group ID' });
      return;
    }
    const userGroup = await UserGroup.findByIdAndDelete(req.params.id);
    if (!userGroup) {
      res.status(404).json({ message: 'User group not found' });
      return;
    }
    log.info({ userGroupId: req.params.id }, 'User group deleted');
    res.json({ message: 'User group deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting user group');
    res.status(500).json({ message: 'Error deleting user group' });
  }
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
router.get('/subscriptions', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const subscriptions = await Subscription.find().sort({ name: 1 });
    res.json({ subscriptions });
  } catch (error) {
    log.error({ err: error }, 'Error fetching subscriptions');
    res.status(500).json({ message: 'Error fetching subscriptions' });
  }
});

router.post('/subscriptions', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, active, featureFlags } = req.body as {
      name: string; description?: string; active?: boolean; featureFlags?: string[];
    };
    if (!name) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }
    const subscription = new Subscription({ name, description, active, featureFlags });
    await subscription.save();
    log.info({ name }, 'Subscription created');
    res.status(201).json({ subscription, message: 'Subscription created successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A subscription with this name already exists' });
      return;
    }
    log.error({ err: error }, 'Error creating subscription');
    res.status(500).json({ message: 'Error creating subscription' });
  }
});

router.put('/subscriptions/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid subscription ID' });
      return;
    }
    const { name, description, active, featureFlags } = req.body;
    const subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      { name, description, active, featureFlags },
      { new: true, runValidators: true },
    );
    if (!subscription) {
      res.status(404).json({ message: 'Subscription not found' });
      return;
    }
    log.info({ subscriptionId: req.params.id }, 'Subscription updated');
    res.json({ subscription, message: 'Subscription updated successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A subscription with this name already exists' });
      return;
    }
    log.error({ err: error }, 'Error updating subscription');
    res.status(500).json({ message: 'Error updating subscription' });
  }
});

router.delete('/subscriptions/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid subscription ID' });
      return;
    }
    const subscription = await Subscription.findByIdAndDelete(req.params.id);
    if (!subscription) {
      res.status(404).json({ message: 'Subscription not found' });
      return;
    }
    log.info({ subscriptionId: req.params.id }, 'Subscription deleted');
    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting subscription');
    res.status(500).json({ message: 'Error deleting subscription' });
  }
});

// ---------------------------------------------------------------------------
// Bot Locales
// ---------------------------------------------------------------------------
router.get('/bot-locales/:botId', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.botId)) {
      res.status(400).json({ message: 'Invalid bot ID' });
      return;
    }
    const locales = await BotLocale.find({ botId: req.params.botId }).sort({ languageCode: 1 });
    res.json({ locales });
  } catch (error) {
    log.error({ err: error }, 'Error fetching bot locales');
    res.status(500).json({ message: 'Error fetching bot locales' });
  }
});

router.put('/bot-locales/:botId/:languageCode', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.botId)) {
      res.status(400).json({ message: 'Invalid bot ID' });
      return;
    }
    const { name, description, personality, systemPrompt } = req.body as {
      name?: string; description?: string; personality?: string; systemPrompt: string;
    };
    if (!systemPrompt) {
      res.status(400).json({ message: 'systemPrompt is required' });
      return;
    }
    const langCode = (req.params.languageCode as string).toLowerCase().trim();
    const locale = await BotLocale.findOneAndUpdate(
      { botId: req.params.botId, languageCode: langCode },
      { name, description, personality, systemPrompt, botId: req.params.botId, languageCode: langCode },
      { new: true, upsert: true, runValidators: true },
    );
    log.info({ botId: req.params.botId, languageCode: langCode }, 'Bot locale upserted');
    res.json({ locale, message: 'Bot locale saved successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error saving bot locale');
    res.status(500).json({ message: 'Error saving bot locale' });
  }
});

router.delete('/bot-locales/:botId/:languageCode', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.botId)) {
      res.status(400).json({ message: 'Invalid bot ID' });
      return;
    }
    const langCode = (req.params.languageCode as string).toLowerCase().trim();
    const locale = await BotLocale.findOneAndDelete({ botId: req.params.botId, languageCode: langCode });
    if (!locale) {
      res.status(404).json({ message: 'Bot locale not found' });
      return;
    }
    log.info({ botId: req.params.botId, languageCode: langCode }, 'Bot locale deleted');
    res.json({ message: 'Bot locale deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting bot locale');
    res.status(500).json({ message: 'Error deleting bot locale' });
  }
});

// ---------------------------------------------------------------------------
// Sessions (admin view — all users)
// ---------------------------------------------------------------------------
router.get('/sessions', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    const userId = req.query.userId as string | undefined;
    if (userId) {
      if (!isValidObjectId(userId)) {
        res.status(400).json({ message: 'Invalid userId filter' });
        return;
      }
      filter.userId = userId;
    }

    const [sessions, total] = await Promise.all([
      ChatSession.find(filter)
        .populate('userId', 'email')
        .populate('botId', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ChatSession.countDocuments(filter),
    ]);

    // Attach message counts
    const sessionIds = sessions.map((s) => s._id);
    const counts = await Message.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $group: { _id: '$sessionId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c: { _id: unknown; count: number }) => [String(c._id), c.count]));
    const sessionsWithCounts = sessions.map((s) => ({
      ...s,
      messageCount: countMap.get(String(s._id)) || 0,
    }));

    res.json({ sessions: sessionsWithCounts, total, page, limit });
  } catch (error) {
    log.error({ err: error }, 'Error fetching sessions');
    res.status(500).json({ message: 'Error fetching sessions' });
  }
});

router.get('/sessions/:id/messages', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }
    const messages = await Message.find({ sessionId: req.params.id }).sort({ createdAt: 1 }).lean();
    res.json({ messages });
  } catch (error) {
    log.error({ err: error }, 'Error fetching session messages');
    res.status(500).json({ message: 'Error fetching session messages' });
  }
});

router.delete('/sessions/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }
    const session = await ChatSession.findByIdAndDelete(req.params.id);
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }
    await Message.deleteMany({ sessionId: req.params.id });
    log.info({ sessionId: req.params.id }, 'Session deleted by admin');
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting session');
    res.status(500).json({ message: 'Error deleting session' });
  }
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
const VALID_TOOL_TYPES = ['wikipedia', 'client_memory'] as const;

router.get('/tools', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const tools = await Tool.find().sort({ name: 1 });
    res.json({ tools });
  } catch (error) {
    log.error({ err: error }, 'Error fetching tools');
    res.status(500).json({ message: 'Error fetching tools' });
  }
});

router.post('/tools', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, displayName, description, type, enabled, config } = req.body as {
      name: string; displayName: string; description: string; type: string; enabled?: boolean; config?: Record<string, unknown>;
    };
    if (!name || !displayName || !description || !type) {
      res.status(400).json({ message: 'name, displayName, description, and type are required' });
      return;
    }
    if (!VALID_TOOL_TYPES.includes(type as typeof VALID_TOOL_TYPES[number])) {
      res.status(400).json({ message: `Type must be one of: ${VALID_TOOL_TYPES.join(', ')}` });
      return;
    }
    const sanitizedConfig: Record<string, unknown> = {};
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      if (typeof config.maxResults === 'number') sanitizedConfig.maxResults = Math.min(10, Math.max(1, config.maxResults));
      if (typeof config.language === 'string') sanitizedConfig.language = config.language.slice(0, 10);
    }
    const tool = new Tool({ name, displayName, description, type, enabled: !!enabled, config: sanitizedConfig });
    await tool.save();
    log.info({ toolId: tool._id, name }, 'Tool created');
    res.status(201).json({ tool, message: 'Tool created successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A tool with this name already exists' });
      return;
    }
    log.error({ err: error }, 'Error creating tool');
    res.status(500).json({ message: 'Error creating tool' });
  }
});

router.put('/tools/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid tool ID' });
      return;
    }
    const { name, displayName, description, type, enabled, config } = req.body as {
      name?: string; displayName?: string; description?: string; type?: string; enabled?: boolean; config?: Record<string, unknown>;
    };
    if (type && !VALID_TOOL_TYPES.includes(type as typeof VALID_TOOL_TYPES[number])) {
      res.status(400).json({ message: `Type must be one of: ${VALID_TOOL_TYPES.join(', ')}` });
      return;
    }
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (displayName !== undefined) update.displayName = displayName;
    if (description !== undefined) update.description = description;
    if (type !== undefined) update.type = type;
    if (enabled !== undefined) update.enabled = !!enabled;
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      const sanitizedConfig: Record<string, unknown> = {};
      if (typeof config.maxResults === 'number') sanitizedConfig.maxResults = Math.min(10, Math.max(1, config.maxResults));
      if (typeof config.language === 'string') sanitizedConfig.language = config.language.slice(0, 10);
      update.config = sanitizedConfig;
    }
    const tool = await Tool.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!tool) {
      res.status(404).json({ message: 'Tool not found' });
      return;
    }
    log.info({ toolId: req.params.id }, 'Tool updated');
    res.json({ tool, message: 'Tool updated successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A tool with this name already exists' });
      return;
    }
    log.error({ err: error }, 'Error updating tool');
    res.status(500).json({ message: 'Error updating tool' });
  }
});

router.delete('/tools/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid tool ID' });
      return;
    }
    const tool = await Tool.findByIdAndDelete(req.params.id);
    if (!tool) {
      res.status(404).json({ message: 'Tool not found' });
      return;
    }
    log.info({ toolId: req.params.id }, 'Tool deleted');
    res.json({ message: 'Tool deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting tool');
    res.status(500).json({ message: 'Error deleting tool' });
  }
});

router.post('/tools/:id/toggle', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid tool ID' });
      return;
    }
    const tool = await Tool.findById(req.params.id);
    if (!tool) {
      res.status(404).json({ message: 'Tool not found' });
      return;
    }
    tool.enabled = !tool.enabled;
    await tool.save();
    log.info({ toolId: req.params.id, enabled: tool.enabled }, 'Tool toggled');
    res.json({ tool, message: `Tool ${tool.enabled ? 'enabled' : 'disabled'} successfully` });
  } catch (error) {
    log.error({ err: error }, 'Error toggling tool');
    res.status(500).json({ message: 'Error toggling tool' });
  }
});

// ---------------------------------------------------------------------------
// Client Memories
// ---------------------------------------------------------------------------
router.get('/client-memories', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const memories = await ClientMemory.find()
      .populate('userId', 'email')
      .populate('botId', 'name')
      .sort({ createdAt: -1 });
    res.json({ memories });
  } catch (error) {
    log.error({ err: error }, 'Error fetching client memories');
    res.status(500).json({ message: 'Error fetching client memories' });
  }
});

router.get('/client-memories/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid memory ID' });
      return;
    }
    const memory = await ClientMemory.findById(req.params.id)
      .populate('userId', 'email')
      .populate('botId', 'name');
    if (!memory) {
      res.status(404).json({ message: 'Memory not found' });
      return;
    }
    res.json({ memory });
  } catch (error) {
    log.error({ err: error }, 'Error fetching client memory');
    res.status(500).json({ message: 'Error fetching client memory' });
  }
});

router.post('/client-memories', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, botId, data } = req.body as { userId: string; botId: string; data?: Record<string, unknown> };
    if (!userId || !isValidObjectId(userId)) {
      res.status(400).json({ message: 'Valid userId is required' });
      return;
    }
    if (!botId || !isValidObjectId(botId)) {
      res.status(400).json({ message: 'Valid botId is required' });
      return;
    }
    const sanitizedData: Record<string, unknown> = {};
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (JSON.stringify(data).length > 10_000) {
        res.status(400).json({ message: 'Memory data exceeds 10 000 character limit' });
        return;
      }
      Object.assign(sanitizedData, data);
    }
    const memory = new ClientMemory({ userId, botId, data: sanitizedData });
    await memory.save();
    await memory.populate('userId', 'email');
    await memory.populate('botId', 'name');
    log.info({ memoryId: memory._id, userId, botId }, 'Client memory created');
    res.status(201).json({ memory, message: 'Client memory created successfully' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A memory entry for this user/bot combination already exists' });
      return;
    }
    log.error({ err: error }, 'Error creating client memory');
    res.status(500).json({ message: 'Error creating client memory' });
  }
});

router.put('/client-memories/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid memory ID' });
      return;
    }
    const { data } = req.body as { data: Record<string, unknown> };
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      res.status(400).json({ message: 'data must be a plain object' });
      return;
    }
    if (JSON.stringify(data).length > 10_000) {
      res.status(400).json({ message: 'Memory data exceeds 10 000 character limit' });
      return;
    }
    const memory = await ClientMemory.findByIdAndUpdate(
      req.params.id,
      { $set: { data } },
      { new: true },
    ).populate('userId', 'email').populate('botId', 'name');
    if (!memory) {
      res.status(404).json({ message: 'Memory not found' });
      return;
    }
    log.info({ memoryId: req.params.id }, 'Client memory updated');
    res.json({ memory, message: 'Client memory updated successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error updating client memory');
    res.status(500).json({ message: 'Error updating client memory' });
  }
});

router.delete('/client-memories/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid memory ID' });
      return;
    }
    const memory = await ClientMemory.findByIdAndDelete(req.params.id);
    if (!memory) {
      res.status(404).json({ message: 'Memory not found' });
      return;
    }
    log.info({ memoryId: req.params.id }, 'Client memory deleted');
    res.json({ message: 'Client memory deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting client memory');
    res.status(500).json({ message: 'Error deleting client memory' });
  }
});

export default router;
