/** seedOnStartup.ts — Conditionally seeds or purges+reseeds the database on API startup. */
import mongoose from 'mongoose';
import { createLogger } from '../config/logger';
import { SEED_ON_EMPTY_DB, PURGE_AND_RESEED } from '../config/seedConfig';
import { ensureDemoDataIfDatabaseEmpty } from './initDefaultData';
import { APP_COLLECTIONS } from './appCollections';
import SeedVersion from '../models/SeedVersion';
import { CURRENT_VERSION, SEED_PATCHES } from './seedPatches';

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
  if (PURGE_AND_RESEED) {
    log.warn('PURGE_AND_RESEED=true — dropping all app collections before seed');
    await purgeAppCollections();
  }

  if (SEED_ON_EMPTY_DB) {
    await ensureDemoDataIfDatabaseEmpty();
  } else {
    log.debug('SEED_ON_EMPTY_DB is not enabled — skipping demo data seed');
  }

  // Seed versioning (migrations) always runs, independent of SEED_ON_EMPTY_DB.
  await applySeedVersioning();
}

// ---------------------------------------------------------------------------
// Seed versioning
// ---------------------------------------------------------------------------

async function applySeedVersioning(): Promise<void> {
  const applied = new Set(
    (await SeedVersion.find({}, 'version').lean()).map((v) => v.version),
  );

  // Fresh database: the initial seed already incorporates all current defaults.
  // Stamp all known versions immediately and skip migration functions.
  if (applied.size === 0) {
    const now = new Date();
    for (const patch of SEED_PATCHES) {
      await SeedVersion.create({ version: patch.version, description: patch.description, appliedAt: now });
      applied.add(patch.version);
    }
    log.info({ current: CURRENT_VERSION }, 'Fresh database: all versions stamped');
    return;
  }

  // Existing database: apply any pending patches in order.
  for (const patch of SEED_PATCHES) {
    if (applied.has(patch.version) || !patch.apply) continue;
    log.info({ version: patch.version, description: patch.description }, 'Applying seed patch');
    await patch.apply();
    await SeedVersion.create({ version: patch.version, description: patch.description, appliedAt: new Date() });
    applied.add(patch.version);
    log.info({ version: patch.version }, 'Seed patch applied');
  }

  log.info(
    { current: CURRENT_VERSION, applied: [...applied] },
    'Seed versioning check complete',
  );
}
