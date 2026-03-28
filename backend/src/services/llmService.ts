/**
 * llmService.ts
 *
 * Public façade for LLM interactions.
 * Selects the appropriate provider based on `config.provider` and delegates
 * all low-level communication to that provider's implementation.
 *
 * Consumers import `streamLLMResponse` and the shared types from this file —
 * they never need to know which provider is active.
 */

import { ILLMConfig } from '../models/LLMConfig';
import { createLogger } from '../config/logger';
import { OllamaToolDefinition } from './toolService';
import { ollamaProvider } from './providers/ollama';
import { openaiProvider } from './providers/openai';
import type { ILLMProvider, ChatMessage, LLMResult } from './providers/types';

// Re-export shared types so existing consumers keep working unchanged.
export type { ChatMessage, ToolCall, LLMResult } from './providers/types';
// Legacy alias kept for backwards-compatibility.
export type { ToolCall as OllamaToolCall } from './providers/types';

const log = createLogger('llm-service');

function getProvider(config: ILLMConfig): ILLMProvider {
  switch (config.provider) {
    case 'ollama':
      return ollamaProvider;
    case 'openai':
      return openaiProvider;
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Stream an LLM response, routing to the correct provider.
 *
 * @param config   LLM configuration (provider, model, apiUrl, …)
 * @param messages Conversation history including the system prompt
 * @param onToken  Callback invoked for each streamed token fragment
 * @param tools    Optional tool definitions to pass to the LLM
 */
export async function streamLLMResponse(
  config: ILLMConfig,
  messages: ChatMessage[],
  onToken: (token: string) => Promise<void>,
  tools?: OllamaToolDefinition[],
): Promise<LLMResult> {
  const provider = getProvider(config);
  log.debug({ provider: config.provider, model: config.model }, 'Routing to LLM provider');
  return provider.stream(config, messages, onToken, tools);
}
