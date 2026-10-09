import type { ServerLogger } from '../logger/createLogger.js';

/**
 * What every request handler can read with `c.get(...)`: the request's id and a logger
 * that already stamps that id as `request_id` on every line it writes.
 */
export type HttpContextVariables = {
  requestId: string;
  requestLogger: ServerLogger;
};

/** The Hono environment type shared by the server app and its middleware. */
export type ServerAppEnvironment = { Variables: HttpContextVariables };
