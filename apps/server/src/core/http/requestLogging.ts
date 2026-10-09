import type { MiddlewareHandler } from 'hono';

import type { ServerLogger } from '../logger/createLogger.js';
import type { ServerAppEnvironment } from './httpContextVariables.js';

/**
 * Middleware that gives each request a logger stamped with its `request_id` and writes
 * one "request handled" line when the answer is ready. Must run after Hono's requestId.
 */
export function logEachRequest(logger: ServerLogger): MiddlewareHandler<ServerAppEnvironment> {
  return async (context, next) => {
    const startedAtMilliseconds = performance.now();
    const requestLogger = logger.child({ request_id: context.get('requestId') });
    context.set('requestLogger', requestLogger);

    await next();

    const durationInMilliseconds = Math.round(performance.now() - startedAtMilliseconds);
    requestLogger.info(
      {
        method: context.req.method,
        path: context.req.path,
        status: context.res.status,
        duration_ms: durationInMilliseconds,
      },
      'request handled',
    );
  };
}
