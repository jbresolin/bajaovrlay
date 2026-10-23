import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { ptBR } from '../messages/ptBR.js';
import type { ServerAppEnvironment } from './httpContextVariables.js';

/**
 * The JSON body of every error answer: a stable code for code, a pt-BR message for people.
 * A Zod schema so a route's OpenAPI description can name it; the type is derived from it.
 */
export const ErrorAnswerBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

/** The JSON body of every error answer, as a TypeScript type. */
export type ErrorAnswerBody = z.infer<typeof ErrorAnswerBodySchema>;

/**
 * Answers an unknown address with a 404 in JSON, never Hono's default plain text or an
 * HTML page, so the control page can always parse what comes back.
 */
export const answerRouteNotFound: NotFoundHandler<ServerAppEnvironment> = (context) => {
  const body: ErrorAnswerBody = {
    error: { code: 'ROUTE_NOT_FOUND', message: ptBR.errors.routeNotFound },
  };
  return context.json(body, 404);
};

/**
 * Answers an unexpected exception with a 500 in JSON and logs it with the request id, and
 * a body that is not JSON with a 400 in JSON. The operator always sees a pt-BR message.
 */
export const answerUnexpectedError: ErrorHandler<ServerAppEnvironment> = (error, context) => {
  // Hono's JSON body validator throws a 400 HTTPException with a plain English line when
  // the body cannot be parsed, before a route's own hook runs. Every body route takes
  // JSON but the media upload, which reads its multipart form itself and answers a body
  // it cannot read with its own 400 (modules/media/api.ts), and nothing of ours throws a
  // 400 HTTPException, so a 400 here means exactly that; it is answered in JSON with a
  // pt-BR message like every other error. If our own 400 HTTPException is ever added,
  // this check must look closer.
  if (error instanceof HTTPException && error.status === 400) {
    const body: ErrorAnswerBody = {
      error: { code: 'MALFORMED_JSON_BODY', message: ptBR.errors.malformedJsonBody },
    };
    return context.json(body, 400);
  }
  // Any other deliberate HTTPException (thrown by Hono middleware) already carries the
  // answer it wants to send.
  if (error instanceof HTTPException) {
    return error.getResponse();
  }
  context.get('requestLogger').error({ err: error }, 'unexpected error while handling a request');
  const body: ErrorAnswerBody = {
    error: { code: 'UNEXPECTED_SERVER_ERROR', message: ptBR.errors.unexpectedServerError },
  };
  return context.json(body, 500);
};
