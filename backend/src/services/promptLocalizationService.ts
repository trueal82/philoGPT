import BotLocale, { IBotLocale } from '../models/BotLocale';
import { IBot } from '../models/Bot';
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
 *   exact match -> 'en-us' -> bot base fields
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
      personality: locale.personality || bot.personality || '',
      name: locale.name || bot.name,
      description: locale.description || bot.description || '',
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
        personality: locale.personality || bot.personality || '',
        name: locale.name || bot.name,
        description: locale.description || bot.description || '',
        resolvedLanguageCode: 'en-us',
        fallbackUsed: true,
      };
    }
  }

  // Final fallback: bot base fields
  log.debug({ botId: bot._id, languageCode: normalizedCode, fallback: 'base' }, 'Locale fallback to bot base fields');
  return {
    systemPrompt: bot.systemPrompt,
    personality: bot.personality || '',
    name: bot.name,
    description: bot.description || '',
    resolvedLanguageCode: 'base',
    fallbackUsed: true,
  };
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
