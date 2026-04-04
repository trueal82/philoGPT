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
 * Variables injected into the global system prompt template.
 * Each key corresponds to a {{PLACEHOLDER}} token in the template string.
 * All values are strings; empty string renders as nothing in the template.
 */
export interface PromptVars {
  /** Current counseling plan summary, or a sentinel "no plan" message. */
  COUNSELING_PLAN: string;
  /** Bullet-list of known client_memory keys for this user+bot. */
  MEMORY_KEY_INDEX: string;
  /** Bot persona name (e.g. "Socrates"). */
  BOT_NAME: string;
  /** Bot personality description. */
  BOT_PERSONALITY: string;
  /** Per-bot system prompt with persona instructions. */
  BOT_SYSTEM_PROMPT: string;
  /** BCP-47 language code the model must respond in (e.g. "en-us"). */
  LANGUAGE_CODE: string;
}

/**
 * Render a system prompt template by replacing all {{KEY}} tokens with the
 * corresponding value from vars. Unknown tokens are replaced with an empty
 * string. This function is pure — it never throws and has no side effects.
 */
export function renderSystemPrompt(template: string, vars: Partial<PromptVars>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key as keyof PromptVars] ?? '');
}



