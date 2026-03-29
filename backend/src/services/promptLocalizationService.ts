import BotLocale, { IBotLocale } from '../models/BotLocale';
import { IBot } from '../models/Bot';
import { ISystemPrompt } from '../models/SystemPrompt';
import { createLogger } from '../config/logger';

const log = createLogger('prompt-localization');

export interface ResolvedBotLocale {
  systemPrompt: string;
  personality: string;
  name: string;
  description: string;
  resolvedLanguageCode: string;
  fallbackUsed: boolean;
}

/**
 * Resolve localized bot content by languageCode with fallback chain:
 *   exact match -> 'en-us'
 * Bot base fields no longer carry localizable content — a locale must exist.
 */
export async function resolveLocale(
  bot: IBot,
  languageCode: string,
): Promise<ResolvedBotLocale> {
  const normalizedCode = languageCode.toLowerCase().trim();

  // Try exact match first
  let locale: IBotLocale | null = await BotLocale.findOne({
    botId: bot._id,
    languageCode: normalizedCode,
  });

  if (locale) {
    log.debug({ botId: bot._id, languageCode: normalizedCode }, 'Exact locale match');
    return {
      systemPrompt: locale.systemPrompt,
      personality: locale.personality || '',
      name: locale.name || '',
      description: locale.description || '',
      resolvedLanguageCode: normalizedCode,
      fallbackUsed: false,
    };
  }

  // Fallback to en-us if not already requesting it
  if (normalizedCode !== 'en-us') {
    locale = await BotLocale.findOne({
      botId: bot._id,
      languageCode: 'en-us',
    });
    if (locale) {
      log.debug({ botId: bot._id, languageCode: normalizedCode, fallback: 'en-us' }, 'Locale fallback to en-us');
      return {
        systemPrompt: locale.systemPrompt,
        personality: locale.personality || '',
        name: locale.name || '',
        description: locale.description || '',
        resolvedLanguageCode: 'en-us',
        fallbackUsed: true,
      };
    }
  }

  // Final fallback: pick any locale that exists for this bot
  locale = await BotLocale.findOne({ botId: bot._id });
  if (locale) {
    log.debug({ botId: bot._id, languageCode: normalizedCode, fallback: locale.languageCode }, 'Locale fallback to first available');
    return {
      systemPrompt: locale.systemPrompt,
      personality: locale.personality || '',
      name: locale.name || '',
      description: locale.description || '',
      resolvedLanguageCode: locale.languageCode,
      fallbackUsed: true,
    };
  }

  // No locale at all — return empty (should not happen with properly seeded data)
  log.warn({ botId: bot._id, languageCode: normalizedCode }, 'No locale found for bot');
  return {
    systemPrompt: '',
    personality: '',
    name: '',
    description: '',
    resolvedLanguageCode: 'none',
    fallbackUsed: true,
  };
}

/**
 * Resolve the global system prompt content for a given language.
 * Fallback chain: exact locale → en-us → base content field.
 */
export function resolveSystemPromptContent(
  prompt: ISystemPrompt | (Pick<ISystemPrompt, 'content' | 'locales'> & Record<string, unknown>),
  languageCode: string,
): string {
  const normalized = languageCode.toLowerCase().trim();
  const locales = prompt.locales;

  if (locales) {
    // Support both Map instances and plain objects (from .lean())
    const get = (key: string): string | undefined =>
      locales instanceof Map ? locales.get(key) : (locales as Record<string, string>)[key];

    const exact = get(normalized);
    if (exact) {
      log.debug({ languageCode: normalized }, 'System prompt exact locale match');
      return exact;
    }

    if (normalized !== 'en-us') {
      const fallback = get('en-us');
      if (fallback) {
        log.debug({ languageCode: normalized, fallback: 'en-us' }, 'System prompt locale fallback');
        return fallback;
      }
    }
  }

  return prompt.content;
}

/**
 * Build the full system message for the LLM, combining localized prompt,
 * personality, and language lock instruction.
 */
export function buildSystemMessage(
  resolved: ResolvedBotLocale,
  lockedLanguageCode: string,
): string {
  const parts: string[] = [];

  if (resolved.personality) {
    parts.push(`Personality: ${resolved.personality}`);
  }

  parts.push(resolved.systemPrompt);

  parts.push(
    `You MUST respond in the language identified by code "${lockedLanguageCode}". Do not switch languages unless explicitly asked by the user to translate something.`,
  );

  return parts.join('\n\n');
}
