import type { ServerLogger } from '../logger/createLogger.js';

/**
 * What every request handler can read with `context.get(...)`: the request's id and a logger
 * that already stamps that id as `request_id` on every line it writes. `apiTokenName` is
 * set only on the routes of the command API, by requireApiToken, once the request's token
 * matched a device of BAJAOVRLAY_API_TOKENS (BAJAOVRLAY-28); everywhere else it is unset.
 */
export type HttpContextVariables = {
  requestId: string;
  requestLogger: ServerLogger;
  apiTokenName?: string;
};

/** The Hono environment type shared by the server app and its middleware. */
export type ServerAppEnvironment = { Variables: HttpContextVariables };
