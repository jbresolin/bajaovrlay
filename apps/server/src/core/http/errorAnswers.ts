import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { ptBR } from '../messages/ptBR.js';
import type { ServerAppEnvironment } from './httpContextVariables.js';

/** The JSON body of every error answer: a stable code for code, a pt-BR message for people. */
export type ErrorAnswerBody = {
  error: { code: string; message: string };
};

/**
 * Answers an unknown address with a 404 in JSON, never Hono's default plain text or an
 * HTML page, so the control page can always parse what comes back.
 */
export const answerRouteNotFound: NotFoundHandler<ServerAppEnvironment> = (c) => {
  const body: ErrorAnswerBody = {
    error: { code: 'ROUTE_NOT_FOUND', message: ptBR.errors.routeNotFound },
  };
  return c.json(body, 404);
};

/**
 * Answers an unexpected exception with a 500 in JSON and logs it with the request id.
 * The stack trace goes to the log only; the operator sees a pt-BR message.
 */
export const answerUnexpectedError: ErrorHandler<ServerAppEnvironment> = (error, c) => {
  // A deliberate HTTPException (thrown by Hono middleware or by us) already carries
  // the answer it wants to send.
  if (error instanceof HTTPException) {
    return error.getResponse();
  }
  c.get('requestLogger').error({ err: error }, 'unexpected error while handling a request');
  const body: ErrorAnswerBody = {
    error: { code: 'UNEXPECTED_SERVER_ERROR', message: ptBR.errors.unexpectedServerError },
  };
  return c.json(body, 500);
};
