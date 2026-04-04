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

import SystemPrompt from '../models/SystemPrompt';
import Tool from '../models/Tool';
import {
  DEFAULT_CLIENT_MEMORY_TOOL_DESCRIPTION,
  DEFAULT_COUNSELING_PLAN_TOOL_DESCRIPTION,
  upgradeSystemPromptCounselingJourneyMap,
  upgradeSystemPromptInitialInterview,
  upgradeSystemPromptMemoryPlanBoundaries,
  upgradeSystemPromptThinking,
} from './defaultPromptTemplates';

export const CURRENT_VERSION = '1.3';

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
  {
    version: '1.1',
    description: 'Clarify durable user memory vs session counseling plan boundaries',
    apply: async () => {
      await Tool.updateOne(
        { name: 'client_memory' },
        { $set: { description: DEFAULT_CLIENT_MEMORY_TOOL_DESCRIPTION } },
      );
      await Tool.updateOne(
        { name: 'counseling_plan' },
        { $set: { description: DEFAULT_COUNSELING_PLAN_TOOL_DESCRIPTION } },
      );

      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptMemoryPlanBoundaries(prompt.content);
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptMemoryPlanBoundaries(localizedContent);
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
  {
    version: '1.2',
    description: 'Require initial interview when user memory is empty',
    apply: async () => {
      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptInitialInterview(prompt.content);
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptInitialInterview(localizedContent);
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
  {
    version: '1.3',
    description: 'Encourage deeper thinking and require multi-step counseling plan arc',
    apply: async () => {
      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptCounselingJourneyMap(upgradeSystemPromptThinking(prompt.content));
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptCounselingJourneyMap(upgradeSystemPromptThinking(localizedContent));
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
];
