import { type LevelWithSilent, type Logger, pino } from 'pino';

/** The server's logger type; every module logs through one of these, never `console`. */
export type ServerLogger = Logger;

/** Every level name the logger accepts, from most to least severe, plus `silent`. */
export const serverLogLevels = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const satisfies readonly LevelWithSilent[];

/** One of serverLogLevels. */
export type ServerLogLevel = (typeof serverLogLevels)[number];

/**
 * Creates the structured JSON logger: one JSON object per line on stdout, with an ISO
 * timestamp and the level as a word (`"level":"info"`) so logs read well without tools.
 * The text goes under `message`, the same key the renderer's log lines use.
 */
export function createLogger(options: { level: ServerLogLevel }): ServerLogger {
  return pino({
    level: options.level,
    base: { service: 'bajaovrlay-server' },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
    formatters: {
      level: (levelName) => ({ level: levelName }),
    },
  });
}
