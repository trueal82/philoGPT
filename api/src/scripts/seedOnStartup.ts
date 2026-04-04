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

  if (!SEED_ON_EMPTY_DB) {
    log.debug('SEED_ON_EMPTY_DB is not enabled — skipping seed check');
    return;
  }

  await ensureDemoDataIfDatabaseEmpty();
  await applySeedVersioning();
}

// ---------------------------------------------------------------------------
// Seed versioning
// ---------------------------------------------------------------------------

async function applySeedVersioning(): Promise<void> {
  const existingCount = await SeedVersion.countDocuments();

  // First run (fresh DB or existing DB upgrading to versioned system):
  // stamp the baseline so future patches have a reference point.
  if (existingCount === 0) {
    const baseline = SEED_PATCHES.find((p) => p.version === CURRENT_VERSION);
    await SeedVersion.create({
      version: CURRENT_VERSION,
      description: baseline?.description ?? `Baseline v${CURRENT_VERSION}`,
      appliedAt: new Date(),
    });
    log.info({ version: CURRENT_VERSION }, 'Seed baseline stamped');
  }

  // Collect already-applied versions
  const applied = new Set(
    (await SeedVersion.find({}, 'version').lean()).map((v) => v.version),
  );

  // Apply any pending patches (those with an apply function not yet in DB)
  for (const patch of SEED_PATCHES) {
    if (applied.has(patch.version) || !patch.apply) continue;
    log.info({ version: patch.version, description: patch.description }, 'Applying seed patch');
    await patch.apply();
    await SeedVersion.create({
      version: patch.version,
      description: patch.description,
      appliedAt: new Date(),
    });
    log.info({ version: patch.version }, 'Seed patch applied');
  }

  log.info(
    { current: CURRENT_VERSION, applied: [...applied] },
    'Seed versioning check complete',
  );
}
