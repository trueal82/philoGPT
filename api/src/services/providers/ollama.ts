/**
 * ollama.ts — Ollama LLM provider implementation.
 *
 * Always uses streaming. Gemma 4 reliably emits tool_calls in the final
 * done chunk, so streaming is safe even with tools.
 *
 * Uses Ollama's native `think: true` parameter so the model's thinking
 * process arrives in a separate `thinking` field on each streamed chunk,
 * cleanly separated from the visible `content`.
 *
 * Also includes a balanced-brace inline tool_call parser for models (e.g. qwen)
 * that emit tool calls as plain text `[tool_call] {"name":"...", ...}`
 * instead of the structured `tool_calls` array.
 */

import { ILLMConfig } from '../../models/LLMConfig';
import { createLogger } from '../../config/logger';
import { OllamaToolDefinition } from '../toolService';
import { ChatMessage, ILLMProvider, LLMResult, LLMStats, ToolCall } from './types';

const log = createLogger('llm-ollama');

interface OllamaChunk {
  message?: { content?: string; thinking?: string; tool_calls?: ToolCall[] };
  done: boolean;
  error?: string;
  // Statistics on the final (done) chunk
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// ---------------------------------------------------------------------------
// Thought-block stripping (safety net for replayed history)
// ---------------------------------------------------------------------------

const THOUGHT_BLOCK_RE = /<\|channel>thought[\s\S]*?<channel\|>/g;

/** Strip any residual Gemma 4 thought blocks from a string. */
export function stripThoughtBlocks(text: string): string {
  return text.replace(THOUGHT_BLOCK_RE, '').trim();
}

class OllamaProvider implements ILLMProvider {
  async stream(
    config: ILLMConfig,
    messages: ChatMessage[],
    onToken: (token: string) => Promise<void>,
    tools?: OllamaToolDefinition[],
    onThinking?: (token: string) => Promise<void>,
  ): Promise<LLMResult> {
    const baseUrl = (config.apiUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    const model = config.model ?? 'llama3.2';

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      think: true,   // Enable Ollama native thinking
    };

    // Build options: always pass top_k for Gemma 4 best-practice
    const opts: Record<string, unknown> = { top_k: 64 };
    if (config.temperature !== undefined) opts.temperature = config.temperature;
    if (config.topP !== undefined) opts.top_p = config.topP;
    body.options = opts;

    if (tools && tools.length > 0) body.tools = tools;

    log.debug(
      { baseUrl, model, messageCount: messages.length, requestPayload: body },
      'Calling Ollama /api/chat with full payload',
    );

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`Ollama connection failed (${baseUrl}): ${(err as Error).message}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Ollama returned HTTP ${response.status}: ${text}`);
    }

    if (!response.body) {
      throw new Error('Ollama response has no body');
    }

    // --- Always-streaming path ---
    const decoder = new TextDecoder();
    let rawBuffer = '';        // partial NDJSON line buffer
    let collectedToolCalls: ToolCall[] = [];
    let fullContent = '';      // accumulated visible content
    let thinkingText = '';     // accumulated thinking text
    let doneStats: LLMStats | undefined;

    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      rawBuffer += decoder.decode(chunk, { stream: true });
      const lines = rawBuffer.split('\n');
      rawBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: OllamaChunk;
        try {
          parsed = JSON.parse(trimmed) as OllamaChunk;
        } catch {
          log.warn({ line: trimmed }, 'Failed to parse Ollama NDJSON line');
          continue;
        }
        if (parsed.error) {
          throw new Error(`Ollama error: ${parsed.error}`);
        }

        // Route thinking tokens (separate field from content)
        const thinkToken = parsed.message?.thinking ?? '';
        if (thinkToken) {
          thinkingText += thinkToken;
          if (onThinking) await onThinking(thinkToken);
        }

        // Route content tokens
        const token = parsed.message?.content ?? '';
        if (token) {
          fullContent += token;
          await onToken(token);
        }

        // Collect tool_calls from any chunk (typically the done chunk)
        const tc = parsed.message?.tool_calls;
        if (tc && tc.length > 0) {
          collectedToolCalls.push(...tc);
        }

        if (parsed.done) {
          log.debug({ rawChunk: parsed }, 'Ollama final (done) chunk');
          doneStats = {
            totalDuration: parsed.total_duration,
            loadDuration: parsed.load_duration,
            promptEvalCount: parsed.prompt_eval_count,
            promptEvalDuration: parsed.prompt_eval_duration,
            evalCount: parsed.eval_count,
            evalDuration: parsed.eval_duration,
          };
        }
      }
    }

    // Flush remaining rawBuffer
    if (rawBuffer.trim()) {
      try {
        const parsed = JSON.parse(rawBuffer.trim()) as OllamaChunk;
        const thinkToken = parsed.message?.thinking ?? '';
        if (thinkToken) {
          thinkingText += thinkToken;
          if (onThinking) await onThinking(thinkToken);
        }
        const token = parsed.message?.content ?? '';
        if (token) {
          fullContent += token;
          await onToken(token);
        }
        const tc = parsed.message?.tool_calls;
        if (tc && tc.length > 0) {
          collectedToolCalls.push(...tc);
        }
      } catch {
        // ignore trailing non-JSON
      }
    }

    // If tool_calls were collected, return them
    if (collectedToolCalls.length > 0) {
      log.debug({ toolCalls: collectedToolCalls }, 'Ollama returned tool calls');
      return { type: 'tool_calls', calls: collectedToolCalls };
    }

    // Fallback: detect inline [tool_call] pattern (qwen-style)
    const tcPrefix = fullContent.indexOf('[tool_call]');
    if (tcPrefix !== -1) {
      const afterTag = fullContent.slice(tcPrefix + '[tool_call]'.length).trimStart();
      const jsonStart = afterTag.indexOf('{');
      if (jsonStart !== -1) {
        let depth = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < afterTag.length; i++) {
          if (afterTag[i] === '{') depth++;
          else if (afterTag[i] === '}') { depth--; if (depth === 0) { jsonEnd = i; break; } }
        }
        if (jsonEnd !== -1) {
          const jsonStr = afterTag.slice(jsonStart, jsonEnd + 1);
          const trailing = afterTag.slice(jsonEnd + 1).trim();
          try {
            const parsed = JSON.parse(jsonStr) as { name: string; arguments: Record<string, unknown> };
            if (parsed.name) {
              log.debug({ parsed, trailing }, 'Parsed inline tool_call from content');
              const call: ToolCall = { function: { name: parsed.name, arguments: parsed.arguments ?? {} } };
              return { type: 'tool_calls', calls: [call], inlineTrailingContent: trailing } as LLMResult;
            }
          } catch (e) {
            log.warn({ raw: jsonStr, err: e }, 'Failed to parse inline tool_call JSON');
          }
        }
      }
    }

    log.debug({ length: fullContent.length }, 'Ollama stream complete');
    return { type: 'response', content: fullContent, thinking: thinkingText || undefined, stats: doneStats };
  }
}

export const ollamaProvider = new OllamaProvider();
