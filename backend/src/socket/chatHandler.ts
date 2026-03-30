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
import { resolveLocale, buildSystemMessage, resolveSystemPromptContent } from '../services/promptLocalizationService';
import {
  getEnabledTools,
  buildOllamaToolDefinitions,
  executeTool,
  getClientMemoryKeys,
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

    const isFirstUserMessageInSession = history.length === 1 && history[0]?.role === 'user';
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
      isFirstUserMessageInSession,
      userIdStr,
      botIdStr,
      socketLog,
    );

    // --- Map history to LLM-compatible messages ---
    const contextMessages: ChatMessage[] = [
      { role: 'system', content: systemMessage },
      ...history.map(mapStoredMessageToChat),
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
    const fullResponse = await runLLMWithToolLoop(
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
    const assistantMessage = new Message({ sessionId, role: 'assistant', content: fullResponse });
    await assistantMessage.save();
    await ChatSession.findByIdAndUpdate(sessionId, { updatedAt: new Date() });

    socket.emit('chat:done', { sessionId, message: assistantMessage });
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
 * Build the full system message: global prompt + locale prompt + optional
 * memory key index on the first turn.
 */
async function buildFullSystemMessage(
  resolved: Awaited<ReturnType<typeof resolveLocale>>,
  lockedLang: string,
  isFirstTurn: boolean,
  userId: string,
  botId: string,
  socketLog: Logger,
): Promise<string> {
  const globalPrompt = await SystemPrompt.findOne({ isActive: true }).lean();
  let systemMsg = '';

  if (globalPrompt?.content) {
    systemMsg += resolveSystemPromptContent(globalPrompt as any, lockedLang) + '\n\n';
  }
  systemMsg += buildSystemMessage(resolved, lockedLang);

  if (isFirstTurn) {
    const memoryKeys = await getClientMemoryKeys(userId, botId);
    const memoryKeyLines =
      memoryKeys.length > 0
        ? memoryKeys.map((key) => `- ${key}`).join('\n')
        : '- (no stored keys yet)';

    systemMsg += [
      '',
      'CLIENT MEMORY KEY INDEX FOR THIS USER/BOT:',
      'Use these exact key names when deciding what to read/update via client_memory.',
      memoryKeyLines,
    ].join('\n');

    socketLog.debug(
      { memoryKeyCount: memoryKeys.length },
      'Injected memory key index into first-turn system prompt',
    );
  }

  return systemMsg;
}

/**
 * Convert a persisted Message document into a ChatMessage for the LLM,
 * replaying tool_calls and tool_name metadata.
 */
function mapStoredMessageToChat(m: Record<string, any>): ChatMessage {
  const msg: ChatMessage = { role: m.role as ChatMessage['role'], content: m.content };

  const meta = m.metadata as Map<string, unknown> | undefined;
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
): Promise<string> {
  const wikiLang = lockedLang.split('-')[0];
  const resolvedBotName = typeof botName === 'string' && botName.trim().length > 0
    ? botName.trim()
    : 'Unknown Bot';
  const emitToken = async (token: string) => {
    socket.emit('chat:token', { sessionId, token });
  };

  let result = await streamLLMResponse(llmConfig, contextMessages, emitToken, toolDefs);

  let toolRound = 0;
  while (result.type === 'tool_calls' && toolRound < MAX_TOOL_ROUNDS) {
    toolRound++;
    socketLog.debug({ round: toolRound, callCount: result.calls.length }, 'Tool-call round');

    for (const call of result.calls) {
      const toolName = call.function.name;
      const toolParams = call.function.arguments;
      socketLog.debug({ toolName, toolParams }, 'Executing tool call');

      const toolStartMs = Date.now();
      let toolResult: string;
      let toolStatus: 'success' | 'error' = 'success';
      let toolError: string | undefined;
      try {
        toolResult = await executeTool(
          toolName,
          toolParams,
          { language: wikiLang },
          { userId, botId },
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

      // Extend context for next LLM round
      contextMessages.push({ role: 'assistant', content: '', tool_calls: [call] });
      contextMessages.push({ role: 'tool', content: toolResult, tool_name: toolName });
    }

    // Capture inline trailing content before re-calling
    const trailingContent = result.type === 'tool_calls' ? result.inlineTrailingContent : undefined;

    result = await streamLLMResponse(llmConfig, contextMessages, emitToken, toolDefs);

    // Use inline trailing content if the LLM returned empty
    if (result.type === 'response' && result.content === '' && trailingContent) {
      socketLog.debug('Using inline trailing content as response');
      result = { type: 'response', content: trailingContent };
      socket.emit('chat:token', { sessionId, token: trailingContent });
    }
  }

  let fullResponse = result.type === 'response' ? result.content : '';

  // Handle exhausted tool rounds with trailing content
  if (fullResponse === '' && result.type === 'tool_calls' && result.inlineTrailingContent) {
    fullResponse = result.inlineTrailingContent;
    socket.emit('chat:token', { sessionId, token: fullResponse });
  }

  // Fallback: retry without tools if response is still empty
  if (fullResponse === '' && toolDefs) {
    socketLog.warn('LLM returned empty response after tool loop; retrying without tools');
    const retry = await streamLLMResponse(llmConfig, contextMessages, emitToken);
    fullResponse = retry.type === 'response' ? retry.content : '';
  }

  return fullResponse;
}
