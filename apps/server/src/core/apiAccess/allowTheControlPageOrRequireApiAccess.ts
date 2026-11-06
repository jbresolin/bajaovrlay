import type { MiddlewareHandler } from 'hono';

import type { ServerAppEnvironment } from '../http/httpContextVariables.js';
import type { ApiTokens } from './apiTokens.js';
import { requireApiAccess } from './requireApiAccess.js';

/**
 * Middleware for a read the control page makes as it reads /state, which a device from
 * outside may make too (GET /api/v1/event-log, BAJAOVRLAY-30). The control page's own fetch
 * (the browser says `Sec-Fetch-Site: same-origin`, and no Authorization header is sent)
 * passes as /state does; every other caller goes through requireApiAccess, the command
 * API's rules: 403 with the API off, 401 to a wrong token, its device's name otherwise.
 * Deliberate: a script can write that header itself and pass, as it can read /state with
 * no header at all; until M4 brings logins this only keeps the route behind the same door
 * as the commands for anything that does not claim to be the page. The Vite dev proxy
 * keeps the browser's headers, so the dev page passes too.
 */
export function allowTheControlPageOrRequireApiAccess(options: {
  apiTokens: ApiTokens;
  isOpenToTheNetwork: boolean;
}): MiddlewareHandler<ServerAppEnvironment> {
  const requireAccessOfTheCommandApi = requireApiAccess(options);
  return async (context, next) => {
    const isSameOriginFetch = context.req.header('sec-fetch-site') === 'same-origin';
    const hasNoToken = context.req.header('authorization') === undefined;
    if (isSameOriginFetch && hasNoToken) {
      await next();
      return undefined;
    }
    return requireAccessOfTheCommandApi(context, next);
  };
}
