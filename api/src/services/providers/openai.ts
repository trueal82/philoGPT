/**
 * openai.ts — OpenAI LLM provider stub.
 *
 * Not yet implemented — throws an error directing the user to configure
 * an Ollama LLM config instead.
 */

import { ILLMConfig } from '../../models/LLMConfig';
import { OllamaToolDefinition } from '../toolService';
import { ChatMessage, ILLMProvider, LLMResult } from './types';

class OpenAIProvider implements ILLMProvider {
  async stream(
    _config: ILLMConfig,
    _messages: ChatMessage[],
    _onToken: (token: string) => Promise<void>,
    _tools?: OllamaToolDefinition[],
  ): Promise<LLMResult> {
    throw new Error(
      'OpenAI provider is not yet implemented. Configure an Ollama LLM config to use this application.',
    );
  }
}

export const openaiProvider = new OpenAIProvider();
