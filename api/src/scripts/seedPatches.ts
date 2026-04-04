/**
 * seedPatches.ts — Declarative list of seed-data patches.
 *
 * Each entry describes a schema / data change that should be applied exactly
 * once, tracked by a SeedVersion record.
 *
 * Rules:
 *  - `version` must be unique and ordered (semver string).
 *  - Entries without an `apply` function are baseline markers — no migration
 *    code, just a version stamp.
 *  - New patches are automatically applied by `seedOnStartup.ts` on boot.
 */

export const CURRENT_VERSION = '1.0';

export interface SeedPatch {
  version: string;
  description: string;
  apply?: () => Promise<void>;
}

export const SEED_PATCHES: SeedPatch[] = [
  {
    version: '1.0',
    description: 'Initial seed: philosophers, tools, global system prompt template with {{PLACEHOLDER}} injection',
    // No apply() — baseline marker. Data seeded by initDefaultData.ts.
  },
  // Future example:
  // {
  //   version: '1.1',
  //   description: 'Add new bot XYZ',
  //   apply: async () => { ... },
  // },
];
