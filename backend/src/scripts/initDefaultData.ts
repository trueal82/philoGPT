import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Bot from '../models/Bot';
import LLMConfig from '../models/LLMConfig';
import Language from '../models/Language';
import UserGroup from '../models/UserGroup';
import Subscription from '../models/Subscription';
import BotLocale from '../models/BotLocale';
import { createLogger } from '../config/logger';
import { ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } from '../config/seedConfig';

const log = createLogger('init-data');
const BCRYPT_ROUNDS = 12;

async function databaseHasAnyUserData(): Promise<boolean> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not initialized');
  }

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const collection of collections) {
    const name = collection.name;
    if (!name || name.startsWith('system.')) continue;
    const doc = await db.collection(name).findOne({}, { projection: { _id: 1 } });
    if (doc) {
      return true;
    }
  }
  return false;
}

export async function ensureDemoDataIfDatabaseEmpty(): Promise<boolean> {
  const hasData = await databaseHasAnyUserData();
  if (hasData) {
    log.info('Skipping demo data seed: database already contains data');
    return false;
  }

  // --- Languages ---
  const langEnUs = new Language({
    code: 'en-us',
    name: 'English (US)',
    nativeName: 'English',
    active: true,
    sortOrder: 0,
  });
  await langEnUs.save();

  const langDeDe = new Language({
    code: 'de-de',
    name: 'German (Germany)',
    nativeName: 'Deutsch',
    active: true,
    sortOrder: 1,
  });
  await langDeDe.save();
  log.info('Created demo languages (en-us, de-de)');

  // --- Subscription ---
  const defaultSubscription = new Subscription({
    name: 'Basic',
    description: 'Default subscription with standard access',
    active: true,
  });
  await defaultSubscription.save();
  log.info('Created demo subscription (Basic)');

  // --- User Group ---
  const defaultUserGroup = new UserGroup({
    name: 'General',
    description: 'Default user group',
    active: true,
  });
  await defaultUserGroup.save();
  log.info('Created demo user group (General)');

  // --- Admin User ---
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
  await mongoose.connection.collection('users').insertOne({
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'admin',
    provider: 'local',
    languageCode: 'en-us',
    userGroupId: defaultUserGroup._id,
    subscriptionId: defaultSubscription._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  log.info({ email: ADMIN_EMAIL }, 'Created demo admin user');

  // --- LLM Config ---
  const defaultLLM = new LLMConfig({
    name: 'Local Ollama',
    provider: 'ollama',
    apiUrl: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 2048,
  });
  await defaultLLM.save();
  log.info('Created demo LLM configuration (Local Ollama)');

  // --- Bot ---
  const defaultBot = new Bot({
    name: 'Philosopher',
    description: 'A philosophical thinking assistant',
    personality: 'Deep, thoughtful, and contemplative',
    systemPrompt:
      'You are a wise philosopher who helps people think deeply about life, ethics, and existence. Be concise but insightful.',
    llmConfigId: defaultLLM._id,
    availableToSubscriptionIds: [defaultSubscription._id],
  });
  await defaultBot.save();
  log.info({ llmConfigId: defaultLLM._id }, 'Created demo bot');

  // --- Bot Locales ---
  const botLocaleEnUs = new BotLocale({
    botId: defaultBot._id,
    languageCode: 'en-us',
    name: 'Philosopher',
    description: 'A philosophical thinking assistant',
    personality: 'Deep, thoughtful, and contemplative',
    systemPrompt:
      'You are a wise philosopher who helps people think deeply about life, ethics, and existence. Be concise but insightful.',
  });
  await botLocaleEnUs.save();

  const botLocaleDeDe = new BotLocale({
    botId: defaultBot._id,
    languageCode: 'de-de',
    name: 'Philosoph',
    description: 'Ein philosophischer Denkassistent',
    personality: 'Tiefgründig, nachdenklich und kontemplativ',
    systemPrompt:
      'Du bist ein weiser Philosoph, der Menschen hilft, tief über das Leben, Ethik und Existenz nachzudenken. Sei prägnant, aber aufschlussreich.',
  });
  await botLocaleDeDe.save();
  log.info('Created demo bot locales (en-us, de-de)');

  log.info('Demo data seed completed');
  return true;
}

async function initDefaultData(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    log.info('Connected to MongoDB');
    await ensureDemoDataIfDatabaseEmpty();
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
  }
}

if (require.main === module) {
  initDefaultData().catch((err: Error) => {
    log.error({ err }, 'Init default data failed');
    process.exit(1);
  });
}
