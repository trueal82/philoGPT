/**
 * chatHandler.ts
 *
 * Socket.IO chat handler — manages the real-time `chat:send` event.
 *
 * Responsibilities:
 *  - Validate incoming payloads (sessionId, content)
 *  - Verify session ownership
 *  - Persist user / assistant / tool messages
 *  - Build the LLM context (system prompt, history, memory keys)
 *  - Execute the tool loop (up to MAX_TOOL_ROUNDS)
 *  - Stream tokens back to the client via Socket.IO
 *
 * Extracted from server.ts to keep the entry-point slim and this logic testable.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

import User, { IUser } from '../models/User';
import Bot from '../models/Bot';
import LLMConfig, { ILLMConfig } from '../models/LLMConfig';
import ChatSession from '../models/ChatSession';
import Message from '../models/Message';
import SystemPrompt from '../models/SystemPrompt';

import { streamLLMResponse, ChatMessage } from '../services/llmService';
import { stripThoughtBlocks } from '../services/providers/ollama';
import { resolveLocale, resolveSystemPromptContent, renderSystemPrompt, PromptVars } from '../services/promptLocalizationService';
import {
  getEnabledTools,
  buildOllamaToolDefinitions,
  executeTool,
  getClientMemoryKeys,
  getCounselingPlanSummary,
} from '../services/toolService';
import { createLogger } from '../config/logger';
import ToolCallLog from '../models/ToolCallLog';
import type pino from 'pino';

const log = createLogger('chat-handler');

type Logger = pino.Logger;

/** Maximum tool-call round-trips before we force a plain response. */
const MAX_TOOL_ROUNDS = 5;

// ---------------------------------------------------------------------------
// JWT Authentication Middleware for Socket.IO
// ---------------------------------------------------------------------------

interface JwtPayload {
  userId: string;
}

/**
 * Register the Socket.IO JWT authentication middleware and the `chat:send`
 * event handler on the given server instance.
 */
export function registerChatHandler(io: SocketIOServer): void {
  // --- Socket-level JWT auth ---
  io.use(async (socket, next) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      log.error('JWT_SECRET not configured — rejecting socket connection');
      return next(new Error('Server configuration error'));
    }

    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }
      if (user.isLocked) {
        return next(new Error('account_locked'));
      }
      socket.data.user = user as IUser;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // --- Per-connection handler ---
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as IUser;
    log.info({ userId: user._id, socketId: socket.id }, 'Socket connected');

    socket.on('chat:send', (payload: { sessionId: string; content: string }) => {
      handleChatSend(socket, user, payload).catch((err) => {
        log.error({ err, socketId: socket.id }, 'Unhandled error in chat:send');
      });
    });

    socket.on('disconnect', () => {
      log.debug({ userId: user._id, socketId: socket.id }, 'Socket disconnected');
    });
  });
}

// ---------------------------------------------------------------------------
// Core chat handler
// ---------------------------------------------------------------------------

async function handleChatSend(
  socket: Socket,
  user: IUser,
  payload: { sessionId: string; content: string },
): Promise<void> {
  const { sessionId, content } = payload ?? {};
  const socketLog = log.child({ socketId: socket.id, userId: user._id, sessionId });

  // --- Input validation ---
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    socket.emit('chat:error', { sessionId, error: 'Invalid session ID' });
    return;
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    socket.emit('chat:error', { sessionId, error: 'Message content is required' });
    return;
  }
  const trimmedContent = content.trim();

  try {
    // --- Verify session ownership and populate bot ---
    const session = await ChatSession.findOne({
      _id: sessionId,
      userId: (user as IUser & { _id: Types.ObjectId })._id,
    }).populate<{ botId: typeof Bot.prototype }>('botId');

    if (!session) {
      socket.emit('chat:error', { sessionId, error: 'Session not found' });
      return;
    }

    const bot = session.botId as unknown as typeof Bot.prototype;
    const botIdStr = String((session.botId as any)?._id ?? session.botId ?? '');
    const userIdStr = String((user as IUser & { _id: Types.ObjectId })._id);

    // --- Persist user message ---
    const userMessage = new Message({ sessionId, role: 'user', content: trimmedContent });
    await userMessage.save();
    socket.emit('chat:user_message', { sessionId, message: userMessage });
    socketLog.debug('User message saved and echoed');

    let llmConfig = await LLMConfig.findOne({ isActive: true }).lean();
    if (!llmConfig) {
      const fallbackConfig = await LLMConfig.findOne().sort({ createdAt: -1 });
      if (fallbackConfig) {
        fallbackConfig.set('isActive', true);
        await fallbackConfig.save();
        llmConfig = fallbackConfig.toObject() as any;
      }
    }

    // --- Ensure there is an active LLM config ---
    if (!llmConfig) {
      socket.emit('chat:error', {
        sessionId,
        error: 'No active LLM config found. Please activate one in the admin panel.',
      });
      return;
    }

    // --- Build conversation context (last 20 messages) ---
    const history = await Message.find({ sessionId }).sort({ createdAt: -1 }).limit(20).lean();
    history.reverse();

    const lockedLang = (session as any).lockedLanguageCode || 'en-us';
    const resolved = await resolveLocale(bot as any, lockedLang);

    // --- Fetch enabled tools ---
    let toolDefs: ReturnType<typeof buildOllamaToolDefinitions> | undefined;
    let enabledToolsList: Awaited<ReturnType<typeof getEnabledTools>> = [];

    if ((llmConfig as ILLMConfig).supportsTools) {
      enabledToolsList = await getEnabledTools();
      if (enabledToolsList.length > 0) {
        toolDefs = buildOllamaToolDefinitions(enabledToolsList);
      }
    }

    // --- Assemble system message (global prompt + bot locale + memory keys) ---
    const systemMessage = await buildFullSystemMessage(
      resolved,
      lockedLang,
      userIdStr,
      botIdStr,
      sessionId,
      socketLog,
    );

    // --- Map history to LLM-compatible messages ---
    const contextMessages: ChatMessage[] = [
      { role: 'system', content: systemMessage },
      ...history.map(mapStoredMessageToChat).filter((m): m is ChatMessage => m !== null),
    ];

    socketLog.debug(
      {
        contextLength: contextMessages.length,
        lockedLanguageCode: lockedLang,
        resolvedLocale: resolved.resolvedLanguageCode,
        fallbackUsed: resolved.fallbackUsed,
      },
      'Starting LLM stream',
    );

    // --- Run the LLM + tool loop ---
    const { content: fullResponse, metadata: responseMeta } = await runLLMWithToolLoop(
      socket,
      socketLog,
      sessionId,
      llmConfig as ILLMConfig,
      contextMessages,
      toolDefs,
      lockedLang,
      userIdStr,
      botIdStr,
      resolved.name,
    );

    // --- Persist assistant response ---
    // Guard against saving bare [tool_call] artefacts as real responses
    const sanitizedResponse = fullResponse.trim() === '[tool_call]' ? '' : fullResponse;
    if (sanitizedResponse === '') {
      socketLog.warn('Final response empty or bare [tool_call]; sending fallback');
    }
    const finalContent = sanitizedResponse || 'I seem to have lost my train of thought. Could you repeat what you just said?';
    const assistantMessage = new Message({
      sessionId,
      role: 'assistant',
      content: finalContent,
      metadata: responseMeta,
    });
    await assistantMessage.save();
    await ChatSession.findByIdAndUpdate(sessionId, { updatedAt: new Date() });

    socket.emit('chat:done', { sessionId, message: assistantMessage, metadata: responseMeta });
    socketLog.info({ responseLength: fullResponse.length }, 'Assistant response complete');
  } catch (err) {
    socketLog.error({ err }, 'Unexpected error in chat:send handler');
    socket.emit('chat:error', { sessionId, error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the full system message by rendering the global prompt template with
 * all injected variables. Each async injector is individually guarded: on
 * failure it logs ERROR and substitutes a static fallback — the prompt is
 * never polluted with error messages or stack traces.
 */
async function buildFullSystemMessage(
  resolved: Awaited<ReturnType<typeof resolveLocale>>,
  lockedLang: string,
  userId: string,
  botId: string,
  sessionId: string,
  socketLog: Logger,
): Promise<string> {
  const globalPrompt = await SystemPrompt.findOne({ isActive: true }).lean();
  const template = globalPrompt ? resolveSystemPromptContent(globalPrompt as any, lockedLang) : '';

  // --- Injector: counseling plan (fails loudly in logs, silently in prompt) ---
  let counselingPlan = 'No counseling plan yet. Use counseling_plan add_step to create one when you identify the user\'s needs.';
  try {
    const result = await getCounselingPlanSummary(sessionId, userId, botId);
    if (result) counselingPlan = result;
  } catch (err) {
    socketLog.error({ err, userId, botId, sessionId }, 'getCounselingPlanSummary failed — using fallback');
  }

  // --- Injector: memory key index (fails loudly in logs, silently in prompt) ---
  let memoryKeyIndex = '- (no stored keys yet)';
  try {
    const keys = await getClientMemoryKeys(userId, botId);
    if (keys.length > 0) {
      memoryKeyIndex = keys.map((k) => `- ${k}`).join('\n');
    }
    socketLog.debug({ memoryKeyCount: keys.length }, 'Memory key index injected');
  } catch (err) {
    socketLog.error({ err, userId, botId }, 'getClientMemoryKeys failed — using fallback');
  }

  const vars: PromptVars = {
    COUNSELING_PLAN: counselingPlan,
    MEMORY_KEY_INDEX: memoryKeyIndex,
    BOT_NAME: resolved.name,
    BOT_PERSONALITY: resolved.personality,
    BOT_SYSTEM_PROMPT: resolved.systemPrompt,
    LANGUAGE_CODE: lockedLang || 'en-us',
  };

  return renderSystemPrompt(template, vars);
}

/**
 * Convert a persisted Message document into a ChatMessage for the LLM,
 * replaying tool_calls and tool_name metadata.
 */
function mapStoredMessageToChat(m: Record<string, any>): ChatMessage | null {
  // Skip bare [tool_call] assistant messages that have no actual tool_calls —
  // these are from previous turns where the model emitted the tag as plain text
  // without a structured payload. Replaying them teaches the model to repeat
  // the broken pattern.
  const meta = m.metadata as Map<string, unknown> | undefined;
  if (m.role === 'assistant' && m.content === '[tool_call]') {
    const tc = meta instanceof Map ? meta.get('tool_calls') : (meta as any)?.tool_calls;
    if (!Array.isArray(tc) || tc.length === 0) {
      return null; // bare [tool_call] with no real tool calls — skip it
    }
  }

  const msg: ChatMessage = { role: m.role as ChatMessage['role'], content: m.content };

  // Strip Gemma 4 thought blocks from replayed assistant messages so the model
  // doesn't see its own previous internal reasoning (per Google best practice).
  if (msg.role === 'assistant') {
    msg.content = stripThoughtBlocks(msg.content);
  }

  if (msg.role === 'assistant' && meta) {
    const tc = meta instanceof Map ? meta.get('tool_calls') : (meta as any)?.tool_calls;
    if (Array.isArray(tc) && tc.length > 0) {
      msg.tool_calls = tc as ChatMessage['tool_calls'];
    }
  }
  if (msg.role === 'tool' && meta) {
    const tn = meta instanceof Map ? meta.get('tool_name') : (meta as any)?.tool_name;
    if (typeof tn === 'string') {
      msg.tool_name = tn;
    }
  }
  return msg;
}

/**
 * Execute the LLM streaming response + iterative tool-call loop.
 *
 * Returns the final assistant text content.
 */
async function runLLMWithToolLoop(
  socket: Socket,
  socketLog: Logger,
  sessionId: string,
  llmConfig: ILLMConfig,
  contextMessages: ChatMessage[],
  toolDefs: ReturnType<typeof buildOllamaToolDefinitions> | undefined,
  lockedLang: string,
  userId: string,
  botId: string,
  botName: string,
): Promise<{ content: string; metadata: Record<string, unknown> }> {
  const startTime = Date.now();
  const toolCallNames: string[] = [];
  let thinkingText = '';
  const wikiLang = lockedLang.split('-')[0];
  const resolvedBotName = typeof botName === 'string' && botName.trim().length > 0
    ? botName.trim()
    : 'Unknown Bot';
  const emitToken = async (token: string) => {
    socket.emit('chat:token', { sessionId, token });
  };
  const emitThinking = async (token: string) => {
    thinkingText += token;
    socket.emit('chat:thinking', { sessionId, token });
  };

  let result = await streamLLMResponse(llmConfig, contextMessages, emitToken, toolDefs, emitThinking);

  let toolRound = 0;
  while (result.type === 'tool_calls' && toolRound < MAX_TOOL_ROUNDS) {
    toolRound++;
    socketLog.debug({ round: toolRound, callCount: result.calls.length }, 'Tool-call round');

    for (const call of result.calls) {
      const toolName = call.function.name;
      const toolParams = call.function.arguments;
      socketLog.debug({ toolName, toolParams }, 'Executing tool call');
      toolCallNames.push(toolName);

      const toolStartMs = Date.now();
      let toolResult: string;
      let toolStatus: 'success' | 'error' = 'success';
      let toolError: string | undefined;
      try {
        toolResult = await executeTool(
          toolName,
          toolParams,
          { language: wikiLang },
          { userId, botId, sessionId },
        );
      } catch (execErr: any) {
        toolStatus = 'error';
        toolError = execErr?.message ?? String(execErr);
        toolResult = `Error executing tool: ${toolError}`;
      }
      const toolElapsedMs = Date.now() - toolStartMs;

      // Persist each tool call before continuing so logs are not dropped.
      try {
        await ToolCallLog.create({
          sessionId,
          userId,
          botId,
          botName: resolvedBotName,
          toolName,
          toolDisplayName: toolName,
          inputParams: toolParams,
          outputResult: typeof toolResult === 'string' ? toolResult.slice(0, 50000) : String(toolResult),
          executionTimeMs: toolElapsedMs,
          status: toolStatus,
          errorMessage: toolError,
        });
      } catch (err: unknown) {
        socketLog.warn({ err, toolName }, 'Failed to persist tool-call log');
      }

      // Persist tool-call assistant message
      await new Message({
        sessionId,
        role: 'assistant',
        content: '[tool_call]',
        metadata: { tool_calls: [call] },
      }).save();

      // Persist tool result message
      await new Message({
        sessionId,
        role: 'tool',
        content: toolResult,
        metadata: { tool_name: toolName, tool_result: true },
      }).save();

      // Notify client of memory writes
      if (
        toolName === 'client_memory' &&
        toolParams.action === 'write' &&
        toolResult.startsWith('Memory updated:')
      ) {
        socket.emit('memory:created', { key: toolParams.key, value: toolParams.value });

        const updatedKeys = await getClientMemoryKeys(userId, botId);
        if (updatedKeys.length > 0) {
          const keyIndex = ['UPDATED CLIENT MEMORY KEY INDEX:', ...updatedKeys.map((k) => `- ${k}`)].join('\n');
          contextMessages.push({ role: 'tool', content: keyIndex, tool_name: 'client_memory' });
        }
      }

      // Notify client of counseling plan changes
      if (
        toolName === 'counseling_plan' &&
        (toolParams.action === 'add_step' || toolParams.action === 'update_step_status')
      ) {
        socket.emit('plan:updated', { sessionId });
      }

      // Extend context for next LLM round
      contextMessages.push({ role: 'assistant', content: '', tool_calls: [call] });
      contextMessages.push({ role: 'tool', content: toolResult, tool_name: toolName });
    }

    // Capture inline trailing content before re-calling
    const trailingContent = result.type === 'tool_calls' ? result.inlineTrailingContent : undefined;

    // Add a continuation hint so the model knows it should respond to the user
    // after processing tool results (some models return empty otherwise).
    contextMessages.push({
      role: 'system',
      content: 'Tool calls have been processed. Now respond naturally to the user based on the conversation and tool results above. Do not make another tool call unless absolutely necessary.',
    });

    result = await streamLLMResponse(llmConfig, contextMessages, emitToken, toolDefs, emitThinking);

    // Use inline trailing content if the LLM returned empty
    if (result.type === 'response' && result.content === '' && trailingContent) {
      socketLog.debug('Using inline trailing content as response');
      result = { type: 'response', content: trailingContent };
      socket.emit('chat:token', { sessionId, token: trailingContent });
    }
  }

  let fullResponse = result.type === 'response' ? result.content : '';
  let lastStats = result.type === 'response' ? result.stats : undefined;

  // Handle exhausted tool rounds with trailing content
  if (fullResponse === '' && result.type === 'tool_calls' && result.inlineTrailingContent) {
    fullResponse = result.inlineTrailingContent;
    socket.emit('chat:token', { sessionId, token: fullResponse });
  }

  // Fallback: retry without tools if response is still empty
  if (fullResponse === '' && toolDefs) {
    socketLog.warn('LLM returned empty response after tool loop; retrying without tools');

    // Flatten tool-related messages into plain text so the model can
    // understand the context without tool support enabled.
    const flattenedMessages = contextMessages.map((msg) => {
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const callDesc = msg.tool_calls
          .map((tc) => `[Used tool: ${tc.function.name}(${JSON.stringify(tc.function.arguments)})]`)
          .join('\n');
        return { role: 'assistant' as const, content: callDesc };
      }
      if (msg.role === 'tool') {
        return {
          role: 'assistant' as const,
          content: `[Tool result from ${msg.tool_name ?? 'unknown'}]: ${msg.content}`,
        };
      }
      return msg;
    });
    // Add a nudge to respond
    flattenedMessages.push({
      role: 'system',
      content: 'Now respond to the user naturally, incorporating the tool results above.',
    });

    const retry = await streamLLMResponse(llmConfig, flattenedMessages, emitToken, undefined, emitThinking);
    fullResponse = retry.type === 'response' ? retry.content : '';
    if (retry.type === 'response' && retry.stats) lastStats = retry.stats;
  }

  const durationMs = Date.now() - startTime;
  const metadata: Record<string, unknown> = {
    model: llmConfig.model,
    durationMs,
  };
  if (toolCallNames.length > 0) metadata.toolCalls = toolCallNames;
  if (thinkingText) metadata.thinking = thinkingText;
  if (lastStats) {
    if (lastStats.evalCount && lastStats.evalDuration) {
      metadata.tokensPerSecond = Math.round((lastStats.evalCount / lastStats.evalDuration) * 1e9 * 100) / 100;
    }
    if (lastStats.evalCount) metadata.evalTokens = lastStats.evalCount;
    if (lastStats.promptEvalCount) metadata.promptTokens = lastStats.promptEvalCount;
    if (lastStats.totalDuration) metadata.totalDurationNs = lastStats.totalDuration;
  }

  return { content: fullResponse, metadata };
}
