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

import vm from 'vm';
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
      action: { type: 'string', description: '"read" to retrieve durable cross-session memory for this user, or "write" to persist a durable user fact, preference, or enduring context that should still matter in future sessions' },
      key: { type: 'string', description: 'A durable key such as "name", "age", "occupation", "language_preference", "important_relation_1", or "recurring_struggle_1" (required for write). Do not use counseling-process keys like "counseling_path", "next_intended_topic", or "last_session_summary".' },
      value: { type: 'string', description: 'The value to store in concise user-grounded wording (required for write)' },
    },
    required: ['action'],
  },
  counseling_plan: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '"read" to retrieve the current counseling plan for this session, "add_step" to append a new therapeutic step or phase, or "update_step_status" to change the status of an existing step and record current process evidence' },
      step_title: { type: 'string', description: 'Short user-visible title of the step to add (required for add_step)' },
      step_description: { type: 'string', description: 'Optional explanation of what this step is for; use this for session/process context rather than client memory (for add_step)' },
      step_id: { type: 'string', description: 'The ID of the step to update (required for update_step_status)' },
      status: { type: 'string', description: 'New status: "pending", "in_progress", or "completed" (required for update_step_status)' },
      evidence: { type: 'string', description: 'Optional progress note, breakthrough, resistance, next intended topic, or other session-specific evidence for the step update' },
      plan_title: { type: 'string', description: 'Optional title for the counseling plan (used on first add_step if plan does not yet exist)' },
    },
    required: ['action'],
  },
  system2: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code to execute in a sandboxed Node.js environment. Use console.log() for output. Has access to fetch() for HTTP requests, Math, JSON, Date, URL, URLSearchParams, Map, Set, BigInt, and all standard ECMAScript built-ins. No file system, no require(), no process access. Supports top-level await.',
      },
    },
    required: ['code'],
  },
};

const BLOCKED_CLIENT_MEMORY_KEYS = new Set([
  'first_interaction_topic',
  'core_challenge',
  'counseling_path',
  'counseling_step_current',
  'last_session_summary',
  'next_intended_topic',
]);

const BLOCKED_CLIENT_MEMORY_KEY_PATTERNS = [
  /^counseling_step_(?:n|\d+)_status$/i,
  /^seed_(?:n|\d+)$/i,
  /^breakthrough_(?:n|\d+)$/i,
];

const CLIENT_MEMORY_BOUNDARY_MESSAGE = 'This key belongs in counseling_plan, not client_memory. Use counseling_plan for current steps, next intended topic, session summaries, breakthroughs, and other process notes.';

function isAllowedClientMemoryKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return false;
  if (BLOCKED_CLIENT_MEMORY_KEYS.has(normalized)) return false;
  return !BLOCKED_CLIENT_MEMORY_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizeClientMemoryData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => isAllowedClientMemoryKey(key)),
  );
}

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

  return Object.keys(sanitizeClientMemoryData(data as Record<string, unknown>)).sort((a, b) => a.localeCompare(b));
}

/**
 * Dispatch execution to the correct tool handler based on name/type.
 * Returns a plain-text result string suitable for injection into LLM context.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>,
  context?: {
    userId: string;
    botId: string;
    sessionId?: string;
    /** Optional LLM-powered compressor injected by the caller (chatHandler).
     *  Receives the full article text and must return a condensed string. */
    compressFn?: (text: string) => Promise<string>;
  },
): Promise<string> {
  const tool = await Tool.findOne({ name: toolName, enabled: true });
  if (!tool) {
    return `Tool "${toolName}" is not available.`;
  }

  const mergedConfig = { ...tool.config, ...config };

  switch (tool.type) {
    case 'wikipedia':
      return executeWikipedia(String(params.query ?? ''), mergedConfig, context?.compressFn);
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
    case 'system2':
      return executeSystem2(String(params.code ?? ''), mergedConfig);
    default:
      return `Unknown tool type: ${tool.type}`;
  }
}

/** Maximum characters of raw article text sent to the compressor LLM. */
const ARTICLE_CHAR_LIMIT = 12_000;

/**
 * Minimum characters the REST summary extract must have before we skip the
 * full-article fetch. Famous subjects (philosophers, historical figures) always
 * exceed this; obscure stubs will fall through to the full extract.
 */
const SUMMARY_MIN_CHARS = 500;

/**
 * Article text shorter than this is returned raw without LLM compression,
 * avoiding a full second inference pass for content that is already concise.
 */
const COMPRESS_THRESHOLD = 2500;

/** Per-request fetch timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 8_000;

/** Wrap fetch with a hard timeout so a slow Wikipedia server cannot hang the chat. */
function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Fetch the full plain text extract for a resolved Wikipedia article title.
 * Uses the MediaWiki Action API with explaintext=1 so the result is clean prose.
 */
async function fetchWikipediaExtract(
  title: string,
  language: string,
  headers: Record<string, string>,
): Promise<string> {
  const url = `https://${language}.wikipedia.org/w/api.php?` + new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    exsectionformat: 'plain',
    titles: title,
    format: 'json',
  }).toString();

  const resp = await fetchWithTimeout(url, { headers });
  if (!resp.ok) return '';

  const data = await resp.json() as {
    query?: { pages?: Record<string, { extract?: string }> };
  };
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  return page?.extract ?? '';
}

async function executeWikipedia(
  query: string,
  config: Record<string, unknown>,
  compressFn?: (text: string) => Promise<string>,
): Promise<string> {
  if (!query.trim()) {
    return 'No query provided for Wikipedia lookup.';
  }

  const language = typeof config.language === 'string' && /^[a-z]{2,3}$/.test(config.language)
    ? config.language
    : 'en';

  const reqHeaders = { 'User-Agent': 'PhiloGPT/1.0 (tool-service)' };
  log.debug({ query, language }, 'Executing Wikipedia lookup');

  try {
    // Step 1 – resolve canonical article title via the REST summary endpoint.
    // If the summary already returns a sufficiently long extract we use it
    // directly, skipping the full-article fetch in step 3 entirely.
    let resolvedTitle: string | null = null;
    let summaryExtract: string | null = null;

    const summaryResp = await fetchWithTimeout(
      `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.trim())}`,
      { headers: reqHeaders },
    );
    if (summaryResp.ok) {
      const summaryData = await summaryResp.json() as {
        title?: string;
        type?: string;
        extract?: string;
      };
      if (summaryData.type !== 'disambiguation') {
        resolvedTitle = summaryData.title ?? query.trim();
        const ext = summaryData.extract ?? '';
        if (ext.length >= SUMMARY_MIN_CHARS) {
          summaryExtract = ext;
        }
      }
    }

    // Step 2 – if direct lookup missed (404) or returned a disambiguation page,
    // fall back to full-text search and take the top result.
    if (!resolvedTitle) {
      log.debug({ query, language }, 'Wikipedia direct lookup missed; falling back to search');

      const searchResp = await fetchWithTimeout(
        `https://${language}.wikipedia.org/w/api.php?` + new URLSearchParams({
          action: 'query',
          list: 'search',
          srsearch: query.trim(),
          srlimit: '3',
          srprop: 'snippet',
          format: 'json',
          utf8: '1',
        }).toString(),
        { headers: reqHeaders },
      );

      if (!searchResp.ok) {
        return `Wikipedia search failed with status ${searchResp.status}.`;
      }

      const searchData = await searchResp.json() as {
        query?: { search?: Array<{ title: string }> };
      };
      const hits = searchData.query?.search ?? [];
      if (hits.length === 0) {
        return `No Wikipedia article found for "${query}".`;
      }
      resolvedTitle = hits[0].title;
    }

    // Step 3 – fetch the full plain-text article only when the summary extract
    // was absent or too short to be useful.
    let articleText: string;
    if (summaryExtract) {
      log.debug({ resolvedTitle }, 'Using REST summary extract; skipping full-article fetch');
      articleText = `${resolvedTitle}\n\n${summaryExtract}`;
    } else {
      const fullText = await fetchWikipediaExtract(resolvedTitle, language, reqHeaders);
      if (!fullText) {
        return `No Wikipedia article found for "${query}".`;
      }
      articleText = `${resolvedTitle}\n\n${fullText.slice(0, ARTICLE_CHAR_LIMIT)}`;
    }

    // Step 4 – compress via the injected LLM compressor only when the text is
    // long enough to warrant a second inference pass.
    if (compressFn && articleText.length > COMPRESS_THRESHOLD) {
      try {
        const compressed = await compressFn(articleText);
        if (compressed.trim()) {
          log.debug({ resolvedTitle }, 'Wikipedia article compressed by LLM');
          return `${resolvedTitle}: ${compressed.trim()}`;
        }
      } catch (compressionErr) {
        log.warn({ compressionErr, resolvedTitle }, 'Wikipedia LLM compression failed; returning raw extract');
      }
    }

    // Fallback: no compressor, compression failed, or text was already short —
    // return the article text, hard-capped to keep the context window sane.
    const result = `${resolvedTitle}: ${articleText}`;
    return result.length > 4000 ? result.slice(0, 4000) + '...' : result;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      log.warn({ query }, 'Wikipedia fetch timed out');
      return `Wikipedia lookup timed out for "${query}". Please try again.`;
    }
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

    const sanitizedData = sanitizeClientMemoryData(record.data as Record<string, unknown>);
    if (Object.keys(sanitizedData).length === 0) {
      return 'No durable cross-session memory stored yet for this client.';
    }

    return JSON.stringify(sanitizedData, null, 2);
  }

  if (action === 'write') {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey) {
      return 'A "key" is required to write to memory.';
    }
    if (!isAllowedClientMemoryKey(trimmedKey)) {
      log.debug({ userId, botId, key: trimmedKey }, 'Blocked counseling-process key from client memory');
      return CLIENT_MEMORY_BOUNDARY_MESSAGE;
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

// ---------------------------------------------------------------------------
// System 2 — sandboxed JavaScript execution (Kahneman deliberate reasoning)
// ---------------------------------------------------------------------------

/** Maximum characters of captured console output before truncation. */
const SYSTEM2_OUTPUT_CHAR_LIMIT = 8_000;

/**
 * Synchronous-code vm timeout in ms. Guards against tight infinite loops.
 * Async operations are bounded by the separate wall-clock timeout.
 */
const SYSTEM2_SYNC_TIMEOUT_MS = 5_000;

/**
 * Execute user-supplied JavaScript code in a stripped-down Node.js sandbox.
 *
 * Security posture:
 *  - Uses vm.runInNewContext so code cannot access the enclosing scope.
 *  - Sandbox exposes only safe ECMAScript built-ins + wrapped fetch().
 *  - require, process, Buffer, global, globalThis, module, exports,
 *    __dirname, __filename, eval, and Function are intentionally absent.
 *  - Synchronous execution is bounded by SYSTEM2_SYNC_TIMEOUT_MS.
 *  - Async (fetch) execution is bounded by a wall-clock Promise.race timeout.
 *  - All outbound URLs are logged for audit.
 *
 * NOTE: vm.runInNewContext is not a full security sandbox against crafted
 * adversarial payloads. It is appropriate here because code is generated by
 * the LLM, not directly typed by end users.
 */
async function executeSystem2(
  code: string,
  config: Record<string, unknown>,
): Promise<string> {
  if (!code.trim()) {
    return 'No code provided for system2 execution.';
  }

  const wallClockMs =
    typeof config.timeoutMs === 'number'
      ? Math.min(Math.max(config.timeoutMs, 1_000), 30_000)
      : 15_000;

  const outputLines: string[] = [];
  let totalOutputChars = 0;

  function toStr(v: unknown): string {
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  function appendLine(line: string): void {
    if (totalOutputChars < SYSTEM2_OUTPUT_CHAR_LIMIT) {
      outputLines.push(line);
      totalOutputChars += line.length + 1;
    }
  }

  const capturedConsole = {
    log: (...args: unknown[]) => appendLine(args.map(toStr).join(' ')),
    error: (...args: unknown[]) => appendLine('[error] ' + args.map(toStr).join(' ')),
    warn: (...args: unknown[]) => appendLine('[warn] ' + args.map(toStr).join(' ')),
    info: (...args: unknown[]) => appendLine(args.map(toStr).join(' ')),
  };

  // Wrap fetch to log outbound URLs for audit without blocking them.
  const auditedFetch = (input: string | URL, init?: RequestInit): Promise<Response> => {
    log.debug({ url: String(input) }, 'system2 fetch');
    return globalThis.fetch(input as string, init);
  };

  // Curated ECMAScript built-ins. Node-specific or sensitive APIs are absent.
  const sandbox: Record<string, unknown> = {
    console: capturedConsole,
    fetch: auditedFetch,
    Math,
    JSON,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    BigInt,
    Symbol,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    URL,
    URLSearchParams,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Infinity,
    NaN,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
  };

  log.debug({ codeLength: code.length, wallClockMs }, 'system2 executing');

  try {
    // Wrap in async IIFE so the LLM can use top-level await and fetch.
    const wrappedCode = `(async () => {\n${code}\n})()`;

    // runInNewContext returns a Promise when the IIFE is async.
    const vmPromise = vm.runInNewContext(wrappedCode, sandbox, {
      timeout: SYSTEM2_SYNC_TIMEOUT_MS,
      filename: 'system2.js',
    }) as Promise<unknown>;

    // Race async execution against a wall-clock timeout.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Execution timed out after ${wallClockMs}ms`)),
        wallClockMs,
      );
      // Do not let the timer hold the process open.
      if (timeoutId && typeof timeoutId === 'object' && 'unref' in timeoutId) {
        (timeoutId as NodeJS.Timeout).unref();
      }
    });

    const result = await Promise.race([vmPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    const consoleOutput = outputLines.join('\n');
    let resultStr = '';
    if (result !== undefined && result !== null) {
      try {
        resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      } catch {
        resultStr = String(result);
      }
    }

    const parts: string[] = [];
    if (consoleOutput.trim()) parts.push(consoleOutput.trim());
    if (resultStr.trim() && resultStr.trim() !== consoleOutput.trim()) {
      parts.push(`Result: ${resultStr.trim()}`);
    }

    const combined = parts.join('\n\n').slice(0, SYSTEM2_OUTPUT_CHAR_LIMIT);
    log.debug({ lines: outputLines.length, chars: combined.length }, 'system2 execution completed');
    return combined || '(no output)';
  } catch (err: unknown) {
    const message = (err as Error).message ?? String(err);
    log.warn({ codeLength: code.length, error: message }, 'system2 execution error');
    return `Execution error: ${message}`;
  }
}
