import type { MiddlewareHandler } from 'hono';

import type { RequestHandledLogLevel, ServerAppEnvironment } from './httpContextVariables.js';
import {
  createRefusalWarningWindows,
  type RefusalWarningWindows,
} from './refusalWarningWindows.js';

/**
 * Middleware for the routes that D200 buttons poll every second (BAJAOVRLAY-56). Fifteen
 * buttons would otherwise write some 54,000 info lines an hour, so:
 *   - an answered poll's "request handled" line is at debug;
 *   - a refused one (400–499: 401, 403, 404) is at warn the first time per path and status
 *     in any 60 s window, and at debug the rest of that window;
 *   - a failed one (500 and up) is at warn every time: the server broke, not the button.
 * It marks the request as polled before the access check runs, so the check's own lines
 * go to debug too. One set of windows per call, so each server app keeps its own.
 */
export function logPollsByButtonsQuietly(): MiddlewareHandler<ServerAppEnvironment> {
  const refusalWarningWindows = createRefusalWarningWindows();
  return async (context, next) => {
    context.set('isPolledByButtons', true);

    await next();

    const level = chooseLevelOfPollLine(refusalWarningWindows, {
      path: context.req.path,
      httpStatus: context.res.status,
      atMilliseconds: Date.now(),
    });
    context.set('requestHandledLogLevel', level);
  };
}

/** The level of one poll's "request handled" line, by its status and the windows. */
function chooseLevelOfPollLine(
  refusalWarningWindows: RefusalWarningWindows,
  poll: { path: string; httpStatus: number; atMilliseconds: number },
): RequestHandledLogLevel {
  const isFailed = poll.httpStatus >= 500;
  if (isFailed) {
    return 'warn';
  }
  const isRefused = poll.httpStatus >= 400;
  if (!isRefused) {
    return 'debug';
  }
  const isFirstOfItsWindow = refusalWarningWindows.isFirstRefusalOfItsWindow(poll);
  return isFirstOfItsWindow ? 'warn' : 'debug';
}
