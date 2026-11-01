import type { ServerLogger } from '../logger/createLogger.js';

/**
 * What every request handler can read with `context.get(...)`: the request's id and a logger
 * that already stamps that id as `request_id` on every line it writes. `apiCallerName` is
 * set only on the routes of the command API, by requireApiAccess (BAJAOVRLAY-28): the
 * device whose token matched, or "rede" for a call with no token when the API is open;
 * everywhere else it is unset.
 */
export type HttpContextVariables = {
  requestId: string;
  requestLogger: ServerLogger;
  apiCallerName?: string;
};

/** The Hono environment type shared by the server app and its middleware. */
export type ServerAppEnvironment = { Variables: HttpContextVariables };
