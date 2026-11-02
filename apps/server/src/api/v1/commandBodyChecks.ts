// The two checks in front of POST /api/v1/commands that run before its body is parsed
// (gate 2 of PR #34): the body must be sent as JSON, and it must be small. Both answer in
// the error shape every route uses, with a pt-BR reason, so Companion and scripts never
// see Hono's own English plain text.
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { ErrorAnswerBody } from '../../core/http/errorAnswers.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { ptBR } from '../../core/messages/ptBR.js';

/**
 * The largest body POST /commands reads: 256 KB. The largest real command, an
 * importEntities of a season's teams, is far under it; anything bigger is a mistake or
 * an attack, and is refused before it is read in full.
 */
export const largestCommandBodyInBytes = 256 * 1024;

/**
 * Refuses a body whose Content-Type is not JSON (`application/json`, or a `+json` type,
 * a charset allowed) with 415. Without this check the JSON validator answers its own
 * plain text in English.
 */
export function refuseCommandBodyNotSentAsJson(): MiddlewareHandler<ServerAppEnvironment> {
  return async (context, next) => {
    const contentType = context.req.header('content-type') ?? '';
    const mediaType = (contentType.split(';')[0] ?? '').trim().toLowerCase();
    const isSentAsJson = mediaType === 'application/json' || mediaType.endsWith('+json');
    if (!isSentAsJson) {
      const body: ErrorAnswerBody = {
        error: { code: 'BODY_NOT_JSON', message: ptBR.errors.commandBodyNotJson },
      };
      return context.json(body, 415);
    }
    await next();
    return undefined;
  };
}

/** Refuses a body over largestCommandBodyInBytes with 413, before it is read in full. */
export function refuseCommandBodyOverTheLimit(): MiddlewareHandler<ServerAppEnvironment> {
  return bodyLimit({
    maxSize: largestCommandBodyInBytes,
    onError: (context) => {
      const body: ErrorAnswerBody = {
        error: { code: 'BODY_TOO_LARGE', message: ptBR.errors.commandBodyTooLarge },
      };
      return context.json(body, 413);
    },
  });
}
