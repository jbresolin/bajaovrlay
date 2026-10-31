import type { MiddlewareHandler } from 'hono';

import type { ErrorAnswerBody } from '../http/errorAnswers.js';
import type { ServerAppEnvironment } from '../http/httpContextVariables.js';
import { ptBR } from '../messages/ptBR.js';
import {
  type ApiTokens,
  findNameOfMatchingApiToken,
  readBearerTokenFromAuthorizationHeader,
} from './apiTokens.js';

/**
 * Middleware in front of every route of the command API (BAJAOVRLAY-28): 403 when
 * BAJAOVRLAY_API_TOKENS is unset (the API is off), 401 for a missing, malformed or wrong
 * token, and otherwise the device's name in `apiTokenName` for the route. The token
 * itself is never logged nor echoed; a refusal is logged with the request id only.
 */
export function requireApiToken(apiTokens: ApiTokens): MiddlewareHandler<ServerAppEnvironment> {
  return async (context, next) => {
    if (!apiTokens.isSet) {
      const body: ErrorAnswerBody = {
        error: { code: 'API_TURNED_OFF', message: ptBR.errors.apiTurnedOff },
      };
      return context.json(body, 403);
    }
    const presentedToken = readBearerTokenFromAuthorizationHeader(
      context.req.header('authorization'),
    );
    const tokenName =
      presentedToken === undefined
        ? undefined
        : findNameOfMatchingApiToken(apiTokens.tokens, presentedToken);
    if (tokenName === undefined) {
      // Whether a header came at all helps tell "Companion lost its header" from "an old
      // token"; what the header said is never written.
      context
        .get('requestLogger')
        .warn(
          { has_authorization_header: context.req.header('authorization') !== undefined },
          'api request refused: missing, malformed or wrong token',
        );
      const body: ErrorAnswerBody = {
        error: { code: 'API_TOKEN_REFUSED', message: ptBR.errors.apiTokenRefused },
      };
      context.header('WWW-Authenticate', 'Bearer');
      return context.json(body, 401);
    }
    context.set('apiTokenName', tokenName);
    await next();
    return undefined;
  };
}
