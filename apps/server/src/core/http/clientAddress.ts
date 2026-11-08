import type { Context } from 'hono';

import type { ServerAppEnvironment } from './httpContextVariables.js';

/** What @hono/node-server puts in a request's environment: Node's own request. */
type NodeServerBindings = { incoming?: { socket?: { remoteAddress?: string } } } | undefined;

/**
 * The address the request came from, as the TCP socket reports it, or undefined when no
 * socket is behind the request (a test through app.request). X-Forwarded-For is not read:
 * any caller can write it. Behind a reverse proxy this is the proxy's address.
 */
export function readClientAddress(context: Context<ServerAppEnvironment>): string | undefined {
  const bindings = context.env as NodeServerBindings;
  return bindings?.incoming?.socket?.remoteAddress;
}
