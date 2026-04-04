/**
 * ollama.ts — Ollama LLM provider implementation.
 *
 * Supports both streaming (text-only) and non-streaming (tool-aware) modes.
 * When tools are provided, the request uses non-streaming so that tool_calls
 * arrive reliably in a single JSON response.
 *
 * Includes a balanced-brace inline tool_call parser for models (e.g. qwen)
 * that emit tool calls as plain text `[tool_call] {"name":"...", ...}`
 * instead of the structured `tool_calls` array.
 */

import { ILLMConfig } from '../../models/LLMConfig';
import { createLogger } from '../../config/logger';
import { OllamaToolDefinition } from '../toolService';
import { ChatMessage, ILLMProvider, LLMResult, ToolCall } from './types';

const log = createLogger('llm-ollama');

interface OllamaChunk {
  message?: { content?: string; tool_calls?: ToolCall[] };
  done: boolean;
  error?: string;
}

class OllamaProvider implements ILLMProvider {
  async stream(
    config: ILLMConfig,
    messages: ChatMessage[],
    onToken: (token: string) => Promise<void>,
    tools?: OllamaToolDefinition[],
  ): Promise<LLMResult> {
    const baseUrl = (config.apiUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    const model = config.model ?? 'llama3.2';

    // When tools are provided, use non-streaming mode so tool_calls arrive
    // reliably in a single response (many models only emit tool_calls in the
    // final done chunk which can be lost during streaming).
    const useStreaming = !(tools && tools.length > 0);

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: useStreaming,
    };
    if (config.temperature !== undefined) body.options = { temperature: config.temperature };
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

    // --- Non-streaming path (used when tools are present) ---
    if (!useStreaming) {
      const json = await response.json() as OllamaChunk;
      log.debug({ rawResponse: json }, 'Ollama non-streaming response');
      if (json.error) {
        throw new Error(`Ollama error: ${json.error}`);
      }
      const toolCalls = json.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        log.debug({ toolCalls }, 'Ollama returned tool calls (non-streaming)');
        return { type: 'tool_calls', calls: toolCalls };
      }
      const content = json.message?.content ?? '';

      // Some models (e.g. qwen) emit tool calls as plain text instead of the
      // structured tool_calls array. Detect and parse them so the tool loop
      // still works.  Pattern: [tool_call] {"name":"…","arguments":{…}}
      const tcPrefix = content.indexOf('[tool_call]');
      if (tcPrefix !== -1) {
        const afterTag = content.slice(tcPrefix + '[tool_call]'.length).trimStart();
        const jsonStart = afterTag.indexOf('{');
        if (jsonStart !== -1) {
          // Find matching closing brace (balanced)
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
        // Bare [tool_call] with no JSON payload — model tried to call a tool
        // but failed to produce the structured format. Treat as empty response
        // so the retry/fallback logic can handle it.
        log.warn({ content }, 'Bare [tool_call] text with no JSON payload — treating as empty response');
        return { type: 'response', content: '' };
      }

      if (content) {
        await onToken(content);
      }
      return { type: 'response', content };
    }

    // --- Streaming path (text responses without tools) ---
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

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
        if (parsed.done) {
          log.debug({ rawChunk: parsed }, 'Ollama final (done) chunk');
        }
        const token = parsed.message?.content ?? '';
        if (token) {
          fullResponse += token;
          await onToken(token);
        }
        if (parsed.done) {
          const toolCalls = parsed.message?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            log.debug({ toolCalls }, 'Ollama returned tool calls');
            return { type: 'tool_calls', calls: toolCalls };
          }
          log.debug({ length: fullResponse.length, fullResponse }, 'Ollama stream complete');
          return { type: 'response', content: fullResponse };
        }
      }
    }

    // Flush any remaining buffer content
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as OllamaChunk;
        const token = parsed.message?.content ?? '';
        if (token) {
          fullResponse += token;
          await onToken(token);
        }
        if (parsed.done) {
          const toolCalls = parsed.message?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            log.debug({ toolCalls }, 'Ollama returned tool calls (buffer flush)');
            return { type: 'tool_calls', calls: toolCalls };
          }
        }
      } catch {
        // ignore trailing non-JSON
      }
    }

    log.debug(
      { length: fullResponse.length, fullResponse },
      'Ollama stream ended without explicit done flag; returning full response',
    );
    return { type: 'response', content: fullResponse };
  }
}

export const ollamaProvider = new OllamaProvider();
