import mongoose from 'mongoose';
import Bot from '../models/Bot';
import dotenv from 'dotenv';
import { createLogger } from '../config/logger';

dotenv.config();

const log = createLogger('init-bots');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/philogpt';

const defaultBots = [
  {
    name: 'Philosopher',
    description: 'A philosophical thinking assistant',
    personality: 'Deep, thoughtful, and contemplative',
    systemPrompt:
      'You are a wise philosopher who helps people think deeply about life, ethics, and existence. Approach questions with thoughtful analysis and encourage critical thinking.',
  },
  {
    name: 'Scientist',
    description: 'A scientific thinking assistant',
    personality: 'Analytical, evidence-based, and curious',
    systemPrompt:
      'You are a scientist who helps people understand scientific concepts and think critically about evidence. Provide explanations based on facts and research.',
  },
  {
    name: 'Creative Writer',
    description: 'A creative writing assistant',
    personality: 'Imaginative, expressive, and artistic',
    systemPrompt:
      'You are a creative writer who helps people with storytelling, poetry, and creative expression. Use vivid language and imaginative examples.',
  },
];

async function initBots(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    log.info('Connected to MongoDB');

    await Bot.deleteMany({});
    log.info('Cleared existing bots');
    const bots = await Bot.insertMany(defaultBots);
    log.info({ count: bots.length }, 'Inserted default bots');
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
  }
}

initBots().catch((err: Error) => {
  log.error({ err }, 'Init bots failed');
  process.exit(1);
});
