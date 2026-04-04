/** seedOnStartup.ts — Conditionally seeds or purges+reseeds the database on API startup. */
import mongoose from 'mongoose';
import { createLogger } from '../config/logger';
import { SEED_ON_EMPTY_DB, PURGE_AND_RESEED } from '../config/seedConfig';
import { ensureDemoDataIfDatabaseEmpty } from './initDefaultData';
import { APP_COLLECTIONS } from './appCollections';

const log = createLogger('seed');

async function purgeAppCollections(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection not initialized');

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  let dropped = 0;
  let skipped = 0;

  for (const name of APP_COLLECTIONS) {
    if (existing.has(name)) {
      try {
        await db.dropCollection(name);
        dropped++;
        log.info({ collection: name }, 'Dropped collection');
      } catch (err) {
        log.error({ err, collection: name }, 'Failed to drop collection');
        throw err;
      }
    } else {
      skipped++;
    }
  }

  log.info({ dropped, skipped, total: APP_COLLECTIONS.length }, 'Purge summary');
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
