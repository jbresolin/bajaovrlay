import type { MiddlewareHandler } from 'hono';

import type { ServerLogger } from '../logger/createLogger.js';
import type { ServerAppEnvironment } from './httpContextVariables.js';

/**
 * Middleware that gives each request a logger stamped with its `request_id` and writes
 * one "request handled" line when the answer is ready. Must run after Hono's requestId.
 */
export function logEachRequest(logger: ServerLogger): MiddlewareHandler<ServerAppEnvironment> {
  return async (c, next) => {
    const startedAtMs = performance.now();
    const requestLogger = logger.child({ request_id: c.get('requestId') });
    c.set('requestLogger', requestLogger);

    await next();

    const durationMs = Math.round(performance.now() - startedAtMs);
    requestLogger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, duration_ms: durationMs },
      'request handled',
    );
  };
}
