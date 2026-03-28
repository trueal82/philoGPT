import { ILLMConfig } from '../models/LLMConfig';
import { createLogger } from '../config/logger';

const log = createLogger('llm-service');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Stream an LLM response token-by-token.
 *
 * @param config    The LLM configuration to use (provider, model, apiUrl, etc.)
 * @param messages  The conversation history including the system prompt
 * @param onToken   Callback invoked for each streamed token fragment
 * @returns         The full assembled response string
 */
export async function streamLLMResponse(
  config: ILLMConfig,
  messages: ChatMessage[],
  onToken: (token: string) => Promise<void>,
): Promise<string> {
  switch (config.provider) {
    case 'ollama':
      return streamOllama(config, messages, onToken);
    case 'openai':
      throw new Error('OpenAI integration is not yet configured');
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

// ---------------------------------------------------------------------------
// Ollama
// ---------------------------------------------------------------------------

interface OllamaChunk {
  message?: { content?: string };
  done: boolean;
  error?: string;
}

async function streamOllama(
  config: ILLMConfig,
  messages: ChatMessage[],
  onToken: (token: string) => Promise<void>,
): Promise<string> {
  const baseUrl = (config.apiUrl ?? 'http://localhost:11434').replace(/\/$/, '');
  const model = config.model ?? 'llama3.2';

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  };
  if (config.temperature !== undefined) body.options = { temperature: config.temperature };

  log.debug(
    {
      baseUrl,
      model,
      messageCount: messages.length,
      requestPayload: body,
    },
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

  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    // Keep incomplete last line in the buffer
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
      const token = parsed.message?.content ?? '';
      if (token) {
        fullResponse += token;
        await onToken(token);
      }
      if (parsed.done) {
        log.debug(
          {
            length: fullResponse.length,
            fullResponse,
          },
          'Ollama stream complete with full response',
        );
        return fullResponse;
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
    } catch {
      // ignore trailing non-JSON
    }
  }

  log.debug(
    {
      length: fullResponse.length,
      fullResponse,
    },
    'Ollama stream ended without explicit done flag; returning full response',
  );

  return fullResponse;
}
