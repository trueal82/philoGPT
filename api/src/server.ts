/**
 * server.ts
 *
 * Application entry-point. Wires together Express middleware, Socket.IO,
 * MongoDB, route registration, and the real-time chat handler.
 *
 * All chat/LLM logic lives in `socket/chatHandler.ts`; this file stays
 * focused on infrastructure, security, and lifecycle management.
 */

import 'dotenv/config'; // must be first — populates process.env before other modules read it
import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import passport from './config/passport';
import logger, { createLogger } from './config/logger';
import authRoutes from './routes/auth';
import botRoutes from './routes/bots';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';
import { Server as SocketIOServer } from 'socket.io';
import { registerChatHandler } from './socket/chatHandler';
import { seedOnStartup } from './scripts/seedOnStartup';

const app = express();
const httpServer = http.createServer(app);
const PORT = parseInt(process.env.PORT ?? '5001', 10);

const log = createLogger('server');

// ---------------------------------------------------------------------------
// Fail-fast: critical env vars
// ---------------------------------------------------------------------------
if (!process.env.JWT_SECRET) {
  log.fatal('JWT_SECRET is not set — aborting startup');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3001', 'http://localhost:3002'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

log.debug({ allowedOrigins }, 'CORS configured');

// Trust first proxy hop so req.ip / logs reflect real client addresses.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Request parsing & logging
// ---------------------------------------------------------------------------
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
// Socket.IO
// ---------------------------------------------------------------------------
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  pingTimeout: 20_000,
  pingInterval: 25_000,
});

registerChatHandler(io);

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/philogpt';

if (process.env.NODE_ENV !== 'test') {
  log.debug({ uri: MONGODB_URI.replace(/\/\/[^@]+@/, '//<credentials>@') }, 'Connecting to MongoDB');

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      log.info('Connected to MongoDB');
      await seedOnStartup();
    })
    .catch((err: Error) => {
      log.fatal({ err }, 'MongoDB connection error');
      process.exit(1);
    });
}

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
// Graceful shutdown
// ---------------------------------------------------------------------------
function gracefulShutdown(signal: string) {
  log.info({ signal }, 'Received shutdown signal — closing server');

  httpServer.close(() => {
    log.info('HTTP server closed');
    mongoose.connection.close().then(() => {
      log.info('MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force exit after 10 s if graceful close hangs
  setTimeout(() => {
    log.warn('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled errors so the process doesn't silently crash
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  log.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    log.info({ port: PORT, env: process.env.NODE_ENV ?? 'development', logLevel: logger.level }, 'Server started');
  });
}

export default app;
