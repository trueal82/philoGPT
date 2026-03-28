import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * LOG_LEVEL controls verbosity. Pino levels (most → least verbose):
 *   trace → debug → info → warn → error → fatal → silent
 *
 * Defaults:
 *   - test:        silent
 *   - development: debug
 *   - production:  info
 *
 * Override with LOG_LEVEL env var in any environment.
 */
function resolveLevel(): string {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  if (isTest) return 'silent';
  if (isProduction) return 'info';
  return 'debug';
}

const logger = pino({
  level: resolveLevel(),

  // In dev, pipe through pino-pretty for human-readable output.
  // In production, emit newline-delimited JSON (fast, machine-parseable).
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export default logger;

/**
 * Create a child logger scoped to a module / domain.
 *
 * Usage:
 *   import { createLogger } from '../config/logger';
 *   const log = createLogger('auth');
 *   log.debug({ email }, 'login attempt');
 */
export function createLogger(module: string) {
  return logger.child({ module });
}
