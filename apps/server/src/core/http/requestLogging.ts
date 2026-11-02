import type { MiddlewareHandler } from 'hono';

import type { ServerLogger } from '../logger/createLogger.js';
import type { ServerAppEnvironment } from './httpContextVariables.js';

/**
 * Middleware that gives each request a logger stamped with its `request_id` and writes
 * one "request handled" line when the answer is ready. Must run after Hono's requestId.
 * The line is at info, except for a request marked polled by buttons (see below).
 */
export function logEachRequest(logger: ServerLogger): MiddlewareHandler<ServerAppEnvironment> {
  return async (context, next) => {
    const startedAtMilliseconds = performance.now();
    const requestLogger = logger.child({ request_id: context.get('requestId') });
    context.set('requestLogger', requestLogger);

    await next();

    const durationInMilliseconds = Math.round(performance.now() - startedAtMilliseconds);
    const requestLine = {
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      duration_ms: durationInMilliseconds,
    };
    const level = chooseLevelOfRequestHandledLine(
      context.get('isPolledByButtons') === true,
      context.res.status,
    );
    requestLogger[level](requestLine, 'request handled');
  };
}

/**
 * Middleware for a route that buttons poll every second (BAJAOVRLAY-56): marks the
 * request so its log lines go to debug. Fifteen D200 buttons polling each second would
 * otherwise write some 54,000 info lines an hour. It must run before requireApiAccess, so
 * the open mode's own line is quiet too.
 */
export function markRequestAsPolledByButtons(): MiddlewareHandler<ServerAppEnvironment> {
  return async (context, next) => {
    context.set('isPolledByButtons', true);
    await next();
  };
}

/**
 * The level of the "request handled" line: info for every request, except a poll by
 * buttons, which is debug when answered and warn when refused or failed (status 400 and
 * up), so a mis-set button still shows up at the default level.
 */
function chooseLevelOfRequestHandledLine(
  isPolledByButtons: boolean,
  httpStatus: number,
): 'debug' | 'info' | 'warn' {
  if (!isPolledByButtons) {
    return 'info';
  }
  const isRefusedOrFailed = httpStatus >= 400;
  return isRefusedOrFailed ? 'warn' : 'debug';
}
