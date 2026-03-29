/** seedOnStartup.ts — Conditionally seeds or purges+reseeds the database on backend startup. */
import mongoose from 'mongoose';
import { createLogger } from '../config/logger';
import { SEED_ON_EMPTY_DB, PURGE_AND_RESEED } from '../config/seedConfig';
import { ensureDemoDataIfDatabaseEmpty } from './initDefaultData';

const log = createLogger('seed');

const APP_COLLECTIONS = [
  'users',
  'bots',
  'playgroundsessions',
  'messages',
  'systemprompts',
  'profiles',
  'chatsessions',
  'clientmemories',
  'llmconfigs',
  'languages',
  'usergroups',
  'subscriptions',
  'botlocales',
  'tools',
];

async function purgeAppCollections(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection not initialized');

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const name of APP_COLLECTIONS) {
    if (existing.has(name)) {
      await db.dropCollection(name);
      log.info({ collection: name }, 'Dropped collection');
    }
  }
}

export async function seedOnStartup(): Promise<void> {
  if (!SEED_ON_EMPTY_DB) {
    log.debug('SEED_ON_EMPTY_DB is not enabled — skipping seed check');
    return;
  }

  if (PURGE_AND_RESEED) {
    log.warn('PURGE_AND_RESEED=true — dropping all app collections before seed');
    await purgeAppCollections();
  }

  await ensureDemoDataIfDatabaseEmpty();
}
