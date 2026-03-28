import 'dotenv/config'; // must be first — populates process.env before other modules read it
import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import passport from './config/passport';
import logger from './config/logger';
import SystemPrompt from './models/SystemPrompt';
import { ensureDemoDataIfDatabaseEmpty } from './scripts/initDefaultData';
import authRoutes from './routes/auth';
import botRoutes from './routes/bots';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';
import { Server as SocketIOServer } from 'socket.io';
import User, { IUser } from './models/User';
import Bot from './models/Bot';
import LLMConfig from './models/LLMConfig';
import ChatSession from './models/ChatSession';
import Message from './models/Message';
import { streamLLMResponse, ChatMessage } from './services/llmService';
import { resolveLocale, buildSystemMessage } from './services/promptLocalizationService';
import { getEnabledTools, buildOllamaToolDefinitions, executeTool } from './services/toolService';

const app = express();
const httpServer = http.createServer(app);
const PORT = parseInt(process.env.PORT ?? '5001', 10);

const log = logger.child({ module: 'server' });

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3001'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

log.debug({ allowedOrigins }, 'CORS configured');

// ---------------------------------------------------------------------------
// Socket.io
// ---------------------------------------------------------------------------
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

interface JwtPayload {
  userId: string;
}

// Authenticate socket connections via JWT in handshake
io.use(async (socket, next) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
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

io.on('connection', (socket) => {
  const user = socket.data.user as IUser;
  log.info({ userId: user._id, socketId: socket.id }, 'Socket connected');

  socket.on('chat:send', async (payload: { sessionId: string; content: string }) => {
    const { sessionId, content } = payload ?? {};
    const socketLog = log.child({ socketId: socket.id, userId: user._id, sessionId });

    // --- Validate input ---
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
      // --- Verify session ownership ---
      const session = await ChatSession.findOne({
        _id: sessionId,
        userId: (user as IUser & { _id: Types.ObjectId })._id,
      }).populate<{ botId: typeof Bot.prototype }>({
        path: 'botId',
        populate: { path: 'llmConfigId' },
      });

      if (!session) {
        socket.emit('chat:error', { sessionId, error: 'Session not found' });
        return;
      }

      const bot = session.botId as unknown as (typeof Bot.prototype & { llmConfigId?: typeof LLMConfig.prototype });

      // --- Persist user message ---
      const userMessage = new Message({
        sessionId,
        role: 'user',
        content: trimmedContent,
      });
      await userMessage.save();
      socket.emit('chat:user_message', { sessionId, message: userMessage });
      socketLog.debug('User message saved and echoed');

      // --- Check LLM config ---
      if (!bot.llmConfigId) {
        socket.emit('chat:error', { sessionId, error: 'No LLM config assigned to this bot. Please configure one in the admin panel.' });
        return;
      }

      // --- Build context (last 20 messages) ---
      const history = await Message.find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
      history.reverse();

      // Resolve localized prompt using session's locked language
      const lockedLang = (session as any).lockedLanguageCode || 'en-us';
      const resolved = await resolveLocale(bot as any, lockedLang);

      // --- Fetch enabled tools BEFORE building system message so memory hint can be injected ---
      const llmConfig = bot.llmConfigId as unknown as import('./models/LLMConfig').ILLMConfig;
      let toolDefs = undefined;
      let enabledToolsList: Awaited<ReturnType<typeof getEnabledTools>> = [];
      if (llmConfig.supportsTools) {
        enabledToolsList = await getEnabledTools();
        if (enabledToolsList.length > 0) {
          toolDefs = buildOllamaToolDefinitions(enabledToolsList);
        }
      }

      // --- Build system message: global prompt + bot-specific prompt ---
      const globalPrompt = await SystemPrompt.findOne({ isActive: true }).lean();
      let systemMessage = '';
      if (globalPrompt?.content) {
        systemMessage += globalPrompt.content + '\n\n';
      }
      systemMessage += buildSystemMessage(resolved, lockedLang);

      const contextMessages: ChatMessage[] = [
        { role: 'system', content: systemMessage },
        ...history.map((m) => {
          const msg: ChatMessage = { role: m.role as ChatMessage['role'], content: m.content };
          // Replay tool_calls on assistant messages so Ollama sees the full tool conversation
          const meta = m.metadata as Map<string, unknown> | undefined;
          if (msg.role === 'assistant' && meta) {
            const tc = meta instanceof Map ? meta.get('tool_calls') : (meta as any)?.tool_calls;
            if (Array.isArray(tc) && tc.length > 0) {
              msg.tool_calls = tc as ChatMessage['tool_calls'];
            }
          }
          // Replay tool_name on tool messages
          if (msg.role === 'tool' && meta) {
            const tn = meta instanceof Map ? meta.get('tool_name') : (meta as any)?.tool_name;
            if (typeof tn === 'string') {
              msg.tool_name = tn;
            }
          }
          return msg;
        }),
      ];

      socketLog.debug({
        contextLength: contextMessages.length,
        lockedLanguageCode: lockedLang,
        resolvedLocale: resolved.resolvedLanguageCode,
        fallbackUsed: resolved.fallbackUsed,
      }, 'Starting LLM stream');

      let fullResponse = '';
      const MAX_TOOL_ROUNDS = 5;
      try {
        const botIdStr = String((session.botId as any)?._id ?? session.botId ?? '');
        const userIdStr = String((user as IUser & { _id: Types.ObjectId })._id);
        const wikiLang = lockedLang.split('-')[0];

        let result = await streamLLMResponse(
          llmConfig,
          contextMessages,
          async (token) => {
            socket.emit('chat:token', { sessionId, token });
          },
          toolDefs,
        );

        let toolRound = 0;
        while (result.type === 'tool_calls' && toolRound < MAX_TOOL_ROUNDS) {
          toolRound++;
          socketLog.debug({ round: toolRound, callCount: result.calls.length }, 'Tool-call round');

          for (const call of result.calls) {
            const toolName = call.function.name;
            const toolParams = call.function.arguments;
            socketLog.debug({ toolName, toolParams }, 'Executing tool call');

            const toolResult = await executeTool(
              toolName,
              toolParams,
              { language: wikiLang },
              { userId: userIdStr, botId: botIdStr },
            );

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

            // Add to context: assistant with tool_calls, then tool result
            contextMessages.push({ role: 'assistant', content: '', tool_calls: [call] });
            contextMessages.push({ role: 'tool', content: toolResult, tool_name: toolName });
          }

          // Re-call with the extended history — keep tools so model can chain calls
          result = await streamLLMResponse(
            llmConfig,
            contextMessages,
            async (token) => {
              socket.emit('chat:token', { sessionId, token });
            },
            toolDefs,
          );
        }

        fullResponse = result.type === 'response' ? result.content : '';

        // Fallback: if still empty after tool loop, retry without tools
        if (fullResponse === '' && toolDefs) {
          socketLog.warn('LLM returned empty response after tool loop; retrying without tools');
          const retry = await streamLLMResponse(
            llmConfig,
            contextMessages,
            async (token) => {
              socket.emit('chat:token', { sessionId, token });
            },
          );
          fullResponse = retry.type === 'response' ? retry.content : '';
        }
      } catch (llmErr) {
        socketLog.error({ err: llmErr }, 'LLM streaming error');
        socket.emit('chat:error', { sessionId, error: (llmErr as Error).message });
        return;
      }

      // --- Persist assistant message ---
      const assistantMessage = new Message({
        sessionId,
        role: 'assistant',
        content: fullResponse,
      });
      await assistantMessage.save();

      // Update session timestamp
      await ChatSession.findByIdAndUpdate(sessionId, { updatedAt: new Date() });

      socket.emit('chat:done', { sessionId, message: assistantMessage });
      socketLog.info({ responseLength: fullResponse.length }, 'Assistant response complete');
    } catch (err) {
      log.error({ err, sessionId }, 'Unexpected error in chat:send handler');
      socket.emit('chat:error', { sessionId, error: 'Internal server error' });
    }
  });

  socket.on('disconnect', () => {
    log.debug({ userId: user._id, socketId: socket.id }, 'Socket disconnected');
  });
});

// ---------------------------------------------------------------------------
// Global rate limiter — 100 requests per 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' },
  }),
);

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => (req as Request).url === '/health',
    },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(passport.initialize());

// Disable fingerprinting
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/philogpt';

log.debug({ uri: MONGODB_URI.replace(/\/\/[^@]+@/, '//<credentials>@') }, 'Connecting to MongoDB');

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    log.info('Connected to MongoDB');

    if (process.env.SEED_DEMO_DATA !== 'false') {
      const seeded = await ensureDemoDataIfDatabaseEmpty();
      log.debug({ seeded }, 'Demo data seed check completed');
    } else {
      log.info('Skipping demo data seed (SEED_DEMO_DATA=false)');
    }
  })
  .catch((err: Error) => {
    log.fatal({ err }, 'MongoDB connection error');
    process.exit(1);
  });

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// ---------------------------------------------------------------------------
// Global error handler — never leak stack traces to the client
// ---------------------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.error({ err }, 'Unhandled error');
  res.status(500).json({ message: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    log.info({ port: PORT, logLevel: logger.level }, 'Server started');
  });
}

export default app;
