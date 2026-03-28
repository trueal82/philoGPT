import Tool, { ITool } from '../models/Tool';
import ClientMemory from '../models/ClientMemory';
import { createLogger } from '../config/logger';

const log = createLogger('tool-service');

export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

const TOOL_PARAM_MAP: Record<string, OllamaToolDefinition['function']['parameters']> = {
  wikipedia: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query to look up on Wikipedia' },
    },
    required: ['query'],
  },
  client_memory: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '"read" to retrieve all stored memory for this user (call this at the start of every conversation and before any meaningful response), or "write" to persist a key-value fact about the user' },
      key: { type: 'string', description: 'A structured key such as "name", "core_challenge", "counseling_path", "counseling_step_current", "last_session_summary", or "next_intended_topic" (required for write)' },
      value: { type: 'string', description: 'The value to store -- keep concise but meaningful (required for write)' },
    },
    required: ['action'],
  },
};

export async function getEnabledTools(): Promise<ITool[]> {
  return Tool.find({ enabled: true }).lean();
}

export function buildOllamaToolDefinitions(tools: ITool[]): OllamaToolDefinition[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: TOOL_PARAM_MAP[tool.type] ?? {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  }));
}

export async function getClientMemoryKeys(
  userId: string,
  botId: string,
): Promise<string[]> {
  if (!userId || !botId) {
    return [];
  }

  const record = await ClientMemory.findOne({ userId, botId }).lean();
  const data = record?.data ?? {};
  if (typeof data !== 'object' || data === null) {
    return [];
  }

  return Object.keys(data).sort((a, b) => a.localeCompare(b));
}

export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>,
  context?: { userId: string; botId: string },
): Promise<string> {
  const tool = await Tool.findOne({ name: toolName, enabled: true });
  if (!tool) {
    return `Tool "${toolName}" is not available.`;
  }

  const mergedConfig = { ...tool.config, ...config };

  switch (tool.type) {
    case 'wikipedia':
      return executeWikipedia(String(params.query ?? ''), mergedConfig);
    case 'client_memory':
      return executeClientMemory(
        String(params.action ?? 'read'),
        String(params.key ?? ''),
        String(params.value ?? ''),
        context?.userId ?? '',
        context?.botId ?? '',
      );
    default:
      return `Unknown tool type: ${tool.type}`;
  }
}

async function executeWikipedia(
  query: string,
  config: Record<string, unknown>,
): Promise<string> {
  if (!query.trim()) {
    return 'No query provided for Wikipedia lookup.';
  }

  const language = typeof config.language === 'string' && /^[a-z]{2,3}$/.test(config.language)
    ? config.language
    : 'en';

  const encoded = encodeURIComponent(query.trim());
  const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

  log.debug({ query, language, url }, 'Executing Wikipedia lookup');

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PhiloGPT/1.0 (tool-service)' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return `No Wikipedia article found for "${query}".`;
      }
      return `Wikipedia lookup failed with status ${response.status}.`;
    }

    const data = await response.json() as { title?: string; extract?: string; description?: string };
    const title = data.title ?? query;
    const extract = data.extract ?? data.description ?? 'No summary available.';
    const result = `${title}: ${extract}`;

    return result.length > 2000 ? result.slice(0, 2000) + '...' : result;
  } catch (err) {
    log.error({ err, query }, 'Wikipedia lookup error');
    return `Wikipedia lookup failed: ${(err as Error).message}`;
  }
}

async function executeClientMemory(
  action: string,
  key: string,
  value: string,
  userId: string,
  botId: string,
): Promise<string> {
  if (!userId || !botId) {
    return 'Client memory is not available in this context.';
  }

  if (action === 'read') {
    const record = await ClientMemory.findOne({ userId, botId }).lean();
    if (!record || Object.keys(record.data ?? {}).length === 0) {
      return 'No memory stored yet for this client.';
    }
    return JSON.stringify(record.data, null, 2);
  }

  if (action === 'write') {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey) {
      return 'A "key" is required to write to memory.';
    }

    const existing = await ClientMemory.findOne({ userId, botId });
    const currentData: Record<string, unknown> = existing?.data ?? {};
    const updatedData = { ...currentData, [trimmedKey]: trimmedValue };

    // Guard against bloating: cap at ~10 000 chars serialized
    if (JSON.stringify(updatedData).length > 10_000) {
      return 'Memory is full. Please remove old keys before adding new ones.';
    }

    await ClientMemory.findOneAndUpdate(
      { userId, botId },
      { $set: { data: updatedData } },
      { upsert: true, new: true },
    );
    log.debug({ userId, botId, key: trimmedKey }, 'Client memory written');
    return `Memory updated: "${trimmedKey}" stored successfully.`;
  }

  return `Unknown action "${action}". Use "read" or "write".`;
}
