/**
 * seedConfig.ts — Environment-based defaults for database seeding.
 *
 * Values are used by `src/scripts/seedOnStartup.ts` and `src/scripts/initDefaultData.ts`
 * to optionally seed the database on backend startup.
 *
 * Env vars:
 *   SEED_ON_EMPTY_DB  — "true" to seed default data when the database is empty (default: false)
 *   PURGE_AND_RESEED  — "true" to drop all app collections and reseed (default: false)
 *   ADMIN_EMAIL       — email for the initial admin user
 *   ADMIN_PASSWORD    — password for the initial admin user
 */

export const SEED_ON_EMPTY_DB = process.env.SEED_ON_EMPTY_DB === 'true';
export const PURGE_AND_RESEED = process.env.PURGE_AND_RESEED === 'true';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nimda123';
