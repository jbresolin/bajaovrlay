import type { Context, MiddlewareHandler } from 'hono';

import type { ErrorAnswerBody } from '../http/errorAnswers.js';
import type { ServerAppEnvironment } from '../http/httpContextVariables.js';
import { ptBR } from '../messages/ptBR.js';
import {
  apiCallerNameWithoutAToken,
  type ApiTokens,
  findNameOfMatchingApiToken,
  readBearerTokenFromAuthorizationHeader,
} from './apiTokens.js';

/**
 * Middleware in front of every route of the command API (BAJAOVRLAY-28). It sets
 * `apiCallerName` for the route:
 *   - a right token gives its device's name;
 *   - with BAJAOVRLAY_API_OPEN=true, no Authorization header at all gives "rede".
 * It answers 403 when neither variable turns the API on, and 401 for a missing, malformed
 * or wrong token. A token is never logged nor echoed.
 */
export function requireApiAccess(options: {
  apiTokens: ApiTokens;
  isOpenToTheNetwork: boolean;
}): MiddlewareHandler<ServerAppEnvironment> {
  const { apiTokens, isOpenToTheNetwork } = options;
  return async (context, next) => {
    if (!apiTokens.isSet && !isOpenToTheNetwork) {
      const body: ErrorAnswerBody = {
        error: { code: 'API_TURNED_OFF', message: ptBR.errors.apiTurnedOff },
      };
      return context.json(body, 403);
    }
    const authorizationHeader = context.req.header('authorization');
    // Open, only a call with no header at all is the network's. A header that names a
    // wrong token is still refused, so a device set up with an old token is told so
    // instead of pressing on as "rede".
    if (isOpenToTheNetwork && authorizationHeader === undefined) {
      // A button's status poll comes every second; its line goes to debug with the rest
      // of that request (markRequestAsPolledByButtons, BAJAOVRLAY-56). A press stays at info.
      const level = context.get('isPolledByButtons') === true ? 'debug' : 'info';
      const requestLogger = context.get('requestLogger');
      requestLogger[level](
        { api_token_name: apiCallerNameWithoutAToken, client_ip: readClientAddress(context) },
        'api request accepted without a token: the API is open',
      );
      context.set('apiCallerName', apiCallerNameWithoutAToken);
      await next();
      return undefined;
    }
    const presentedToken = readBearerTokenFromAuthorizationHeader(authorizationHeader);
    const tokenName =
      presentedToken === undefined || !apiTokens.isSet
        ? undefined
        : findNameOfMatchingApiToken(apiTokens.tokens, presentedToken);
    if (tokenName === undefined) {
      // Whether a header came at all helps tell "Companion lost its header" from "an old
      // token"; what the header said is never written.
      context
        .get('requestLogger')
        .warn(
          { has_authorization_header: authorizationHeader !== undefined },
          'api request refused: missing, malformed or wrong token',
        );
      const body: ErrorAnswerBody = {
        error: { code: 'API_TOKEN_REFUSED', message: ptBR.errors.apiTokenRefused },
      };
      context.header('WWW-Authenticate', 'Bearer');
      return context.json(body, 401);
    }
    context.set('apiCallerName', tokenName);
    await next();
    return undefined;
  };
}

/** What @hono/node-server puts in a request's environment: Node's own request. */
type NodeServerBindings = { incoming?: { socket?: { remoteAddress?: string } } } | undefined;

/**
 * The address the request came from, as the TCP socket reports it, or undefined when no
 * socket is behind the request (a test through app.request). X-Forwarded-For is not read:
 * any caller can write it. Behind a reverse proxy this is the proxy's address.
 */
function readClientAddress(context: Context<ServerAppEnvironment>): string | undefined {
  const bindings = context.env as NodeServerBindings;
  return bindings?.incoming?.socket?.remoteAddress;
}
