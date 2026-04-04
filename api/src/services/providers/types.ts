import { ILLMConfig } from '../../models/LLMConfig';
import { OllamaToolDefinition } from '../toolService';

/**
 * A single message in the conversation sent to an LLM provider.
 * The `tool_calls` and `tool_name` fields are used for the agentic tool loop.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
}

/** A single tool-call request emitted by the LLM. */
export interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

/** Ollama generation statistics from the final (done) chunk. */
export interface LLMStats {
  totalDuration?: number;    // nanoseconds
  loadDuration?: number;     // nanoseconds
  promptEvalCount?: number;  // tokens in prompt
  promptEvalDuration?: number; // nanoseconds
  evalCount?: number;        // tokens generated
  evalDuration?: number;     // nanoseconds
}

/** What every provider `stream` call must return. */
export type LLMResult =
  | { type: 'response'; content: string; thinking?: string; stats?: LLMStats }
  | { type: 'tool_calls'; calls: ToolCall[]; inlineTrailingContent?: string };

/**
 * Contract that every LLM provider must implement.
 *
 * `stream` should emit tokens via `onToken` while generating a text response,
 * and return either the full response text or the list of tool calls once done.
 * `onThinking` (optional) receives reasoning / chain-of-thought tokens that
 * should NOT appear in the final `content` but may be shown to the user.
 */
export interface ILLMProvider {
  stream(
    config: ILLMConfig,
    messages: ChatMessage[],
    onToken: (token: string) => Promise<void>,
    tools?: OllamaToolDefinition[],
    onThinking?: (token: string) => Promise<void>,
  ): Promise<LLMResult>;
}
