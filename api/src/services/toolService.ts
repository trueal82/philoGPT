/**
 * toolService.ts — Tool definitions, execution, and client memory management.
 *
 * Provides:
 *  - `getEnabledTools` / `buildOllamaToolDefinitions` — discover active tools
 *    and convert them to the tool-call schema expected by LLM providers.
 *  - `executeTool` — dispatcher that runs the appropriate handler (Wikipedia,
 *    client memory, etc.) and returns a plain-text result for the LLM.
 *  - `getClientMemoryKeys` — returns the stored key names for a user/bot pair
 *    so they can be injected into the system prompt.
 */

import Tool, { ITool } from '../models/Tool';
import ClientMemory from '../models/ClientMemory';
import CounselingPlan from '../models/CounselingPlan';
import { createLogger } from '../config/logger';
import { randomUUID } from 'crypto';

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
  counseling_plan: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '"read" to retrieve the current counseling plan for this session, "add_step" to append a new step to the plan, "update_step_status" to change the status of an existing step' },
      step_title: { type: 'string', description: 'Title of the step to add (required for add_step)' },
      step_description: { type: 'string', description: 'Optional longer description of the step (for add_step)' },
      step_id: { type: 'string', description: 'The ID of the step to update (required for update_step_status)' },
      status: { type: 'string', description: 'New status: "pending", "in_progress", or "completed" (required for update_step_status)' },
      evidence: { type: 'string', description: 'Optional progress note or evidence for the step update' },
      plan_title: { type: 'string', description: 'Optional title for the counseling plan (used on first add_step if plan does not yet exist)' },
    },
    required: ['action'],
  },
};

/** Fetch all tools that are currently enabled in the database. */
export async function getEnabledTools(): Promise<ITool[]> {
  return Tool.find({ enabled: true }).lean();
}

/** Convert enabled `ITool` documents into the Ollama function-call schema. */
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

/**
 * Return sorted list of stored memory keys for a user/bot pair.
 * Used to inject the key index into the system prompt so the LLM knows
 * what data is already persisted.
 */
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

/**
 * Dispatch execution to the correct tool handler based on name/type.
 * Returns a plain-text result string suitable for injection into LLM context.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>,
  context?: { userId: string; botId: string; sessionId?: string },
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
    case 'counseling_plan':
      return executeCounselingPlan(
        String(params.action ?? 'read'),
        params,
        context?.sessionId ?? '',
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

    // Auto-suffix duplicate keys: if "foo" exists, store as "foo_1", "foo_2", etc.
    let finalKey = trimmedKey;
    if (finalKey in currentData) {
      let suffix = 1;
      while (`${trimmedKey}_${suffix}` in currentData) suffix++;
      finalKey = `${trimmedKey}_${suffix}`;
    }

    const updatedData = { ...currentData, [finalKey]: trimmedValue };

    // Guard against bloating: cap at ~10 000 chars serialized
    if (JSON.stringify(updatedData).length > 10_000) {
      return 'Memory is full. Please remove old keys before adding new ones.';
    }

    await ClientMemory.findOneAndUpdate(
      { userId, botId },
      { $set: { data: updatedData } },
      { upsert: true, new: true },
    );
    log.debug({ userId, botId, key: finalKey }, 'Client memory written');
    return `Memory updated: "${finalKey}" stored successfully.`;
  }

  return `Unknown action "${action}". Use "read" or "write".`;
}

// ---------------------------------------------------------------------------
// Counseling Plan tool — session-scoped structured plan
// ---------------------------------------------------------------------------

const VALID_STEP_STATUSES = ['pending', 'in_progress', 'completed'] as const;

async function executeCounselingPlan(
  action: string,
  params: Record<string, unknown>,
  sessionId: string,
  userId: string,
  botId: string,
): Promise<string> {
  if (!sessionId || !userId || !botId) {
    return 'Counseling plan is not available in this context.';
  }

  if (action === 'read') {
    const plan = await CounselingPlan.findOne({ sessionId, userId, botId }).lean();
    if (!plan || plan.steps.length === 0) {
      return 'No counseling plan exists for this session yet. Use add_step to create one.';
    }
    const summary = formatPlanSummary(plan.title, plan.steps);
    return summary;
  }

  if (action === 'add_step') {
    const stepTitle = String(params.step_title ?? '').trim();
    if (!stepTitle) {
      return 'A "step_title" is required to add a step.';
    }

    const stepDescription = String(params.step_description ?? '').trim() || undefined;
    const planTitle = String(params.plan_title ?? '').trim() || 'Counseling Plan';

    const newStep = {
      stepId: randomUUID(),
      title: stepTitle,
      description: stepDescription,
      status: 'pending' as const,
      createdAt: new Date(),
    };

    const plan = await CounselingPlan.findOneAndUpdate(
      { sessionId, userId, botId },
      {
        $push: { steps: newStep },
        $setOnInsert: { title: planTitle },
      },
      { upsert: true, new: true },
    );

    log.debug({ sessionId, userId, botId, stepId: newStep.stepId }, 'Counseling plan step added');

    const totalSteps = plan.steps.length;
    return `Step added: "${stepTitle}" (${newStep.stepId}). Plan now has ${totalSteps} step(s).\n\n${formatPlanSummary(plan.title, plan.steps)}`;
  }

  if (action === 'update_step_status') {
    const stepId = String(params.step_id ?? '').trim();
    const status = String(params.status ?? '').trim();
    const evidence = String(params.evidence ?? '').trim() || undefined;

    if (!stepId) {
      return 'A "step_id" is required to update a step.';
    }
    if (!VALID_STEP_STATUSES.includes(status as typeof VALID_STEP_STATUSES[number])) {
      return `Invalid status "${status}". Must be one of: ${VALID_STEP_STATUSES.join(', ')}`;
    }

    const updateFields: Record<string, unknown> = {
      'steps.$.status': status,
    };
    if (evidence) {
      updateFields['steps.$.evidence'] = evidence;
    }
    if (status === 'completed') {
      updateFields['steps.$.completedAt'] = new Date();
    }

    const plan = await CounselingPlan.findOneAndUpdate(
      { sessionId, userId, botId, 'steps.stepId': stepId },
      { $set: updateFields },
      { new: true },
    );

    if (!plan) {
      return `Step "${stepId}" not found in this session's counseling plan.`;
    }

    log.debug({ sessionId, stepId, status }, 'Counseling plan step updated');
    return `Step "${stepId}" updated to "${status}".\n\n${formatPlanSummary(plan.title, plan.steps)}`;
  }

  return `Unknown action "${action}". Use "read", "add_step", or "update_step_status".`;
}

function formatPlanSummary(title: string, steps: Array<{ stepId: string; title: string; status: string; evidence?: string }>): string {
  const statusIcon: Record<string, string> = { pending: '○', in_progress: '◐', completed: '●' };
  const lines = steps.map((s, i) => {
    const icon = statusIcon[s.status] ?? '?';
    let line = `${i + 1}. ${icon} [${s.status}] ${s.title} (id: ${s.stepId})`;
    if (s.evidence) line += `\n   Evidence: ${s.evidence}`;
    return line;
  });
  return `COUNSELING PLAN: ${title}\n${lines.join('\n')}`;
}

/**
 * Return a compact plan summary for injection into the system prompt.
 * Returns empty string if no plan exists yet.
 */
export async function getCounselingPlanSummary(
  sessionId: string,
  userId: string,
  botId: string,
): Promise<string> {
  if (!sessionId || !userId || !botId) return '';
  const plan = await CounselingPlan.findOne({ sessionId, userId, botId }).lean();
  if (!plan || plan.steps.length === 0) return '';
  return formatPlanSummary(plan.title, plan.steps);
}
