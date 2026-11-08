import { LoginRequestSchema, type SessionAnswer, SessionAnswerSchema } from '@bajaovrlay/shared';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import { readClientAddress } from '../../core/http/clientAddress.js';
import { type ErrorAnswerBody, ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { ptBR } from '../../core/messages/ptBR.js';
import type { OperatorLogin } from '../../core/operatorLogin/operatorLogin.js';
import type { OpenOperatorSession } from '../../core/operatorLogin/operatorSessions.js';
import {
  buildSessionClearingSetCookieHeader,
  buildSessionSetCookieHeader,
} from '../../core/operatorLogin/sessionCookie.js';

// A request with no socket behind it (a test through app.request) is counted under this
// one address by the lockout.
const addressOfARequestWithoutASocket = 'sem-endereco';

const sessionAnswerContent = { 'application/json': { schema: SessionAnswerSchema } };
const errorAnswerContent = { 'application/json': { schema: ErrorAnswerBodySchema } };

/** `GET /api/v1/session`: whether the server asks for a login, and the caller's session. */
export const getSessionRoute = createRoute({
  method: 'get',
  path: '/session',
  summary: 'Whether a login is asked for, and who the caller is',
  responses: {
    200: {
      description:
        'isLoginRequired is false while no PINs are set; session is the caller’s, or null.',
      content: sessionAnswerContent,
    },
  },
});

/** `POST /api/v1/session`: the login, a role, its PIN and the station's name. */
export const postSessionRoute = createRoute({
  method: 'post',
  path: '/session',
  summary: 'Log in with a role, its PIN and the station’s name',
  request: { body: { content: { 'application/json': { schema: LoginRequestSchema } } } },
  responses: {
    200: {
      description: 'The new session; the cookie bajaovrlay_sessao is set (HttpOnly, 18 h).',
      content: sessionAnswerContent,
    },
    400: { description: 'No role, or a blank station (pt-BR).', content: errorAnswerContent },
    401: { description: 'A wrong PIN for the role (pt-BR).', content: errorAnswerContent },
    409: { description: 'No PINs are set: there is no login.', content: errorAnswerContent },
    429: {
      description: 'Five wrong PINs from this address: wait (Retry-After, in seconds).',
      content: errorAnswerContent,
    },
  },
});

/** `DELETE /api/v1/session`: "Sair", which ends the caller's session on the server. */
export const deleteSessionRoute = createRoute({
  method: 'delete',
  path: '/session',
  summary: 'Log out ("Sair")',
  responses: {
    200: {
      description: 'The session ended and its cookie emptied.',
      content: sessionAnswerContent,
    },
  },
});

/** The answer of the session routes: whether a login is asked for, and the session. */
function buildSessionAnswer(
  operatorLogin: OperatorLogin,
  session: OpenOperatorSession | undefined,
): SessionAnswer {
  if (session === undefined) {
    return { isLoginRequired: operatorLogin.isLoginRequired, session: null };
  }
  return {
    isLoginRequired: operatorLogin.isLoginRequired,
    session: { role: session.role, station: session.station, expiresAt: session.expiresAt },
  };
}

/**
 * Mounts the three session routes (BAJAOVRLAY-29) on /api/v1. They are open to everyone:
 * they are how a page without a session gets one. A PIN is never logged nor echoed.
 */
export function mountSessionRoutes(
  apiRoutes: OpenAPIHono<ServerAppEnvironment>,
  operatorLogin: OperatorLogin,
): void {
  apiRoutes.openapi(getSessionRoute, (context) => {
    const session = operatorLogin.findSessionOfCookieHeader(context.req.header('cookie'));
    return context.json(buildSessionAnswer(operatorLogin, session), 200);
  });

  apiRoutes.openapi(
    postSessionRoute,
    (context) => {
      const login = context.req.valid('json');
      const outcome = operatorLogin.logIn({
        ...login,
        clientAddress: readClientAddress(context) ?? addressOfARequestWithoutASocket,
      });
      const messages = ptBR.operatorLoginErrors;
      switch (outcome.kind) {
        case 'loggedIn':
          context.header('Set-Cookie', buildSessionSetCookieHeader(outcome.cookieValue));
          return context.json(buildSessionAnswer(operatorLogin, outcome.session), 200);
        case 'wrongPin': {
          const body: ErrorAnswerBody = {
            error: { code: 'WRONG_PIN', message: messages.wrongPin },
          };
          return context.json(body, 401);
        }
        case 'lockedOut': {
          const body: ErrorAnswerBody = {
            error: { code: 'LOGIN_LOCKED', message: messages.loginLocked(outcome.secondsToWait) },
          };
          context.header('Retry-After', String(outcome.secondsToWait));
          return context.json(body, 429);
        }
        case 'loginTurnedOff': {
          const body: ErrorAnswerBody = {
            error: { code: 'LOGIN_TURNED_OFF', message: messages.loginTurnedOff },
          };
          return context.json(body, 409);
        }
      }
    },
    // The station's schema words its refusal in pt-BR; a missing role has a sentence here.
    (validation, context) => {
      if (validation.success) {
        return undefined;
      }
      const stationIssue = validation.error.issues.find((issue) => issue.path[0] === 'station');
      const body: ErrorAnswerBody = {
        error: {
          code: 'INVALID_LOGIN',
          message: stationIssue?.message ?? ptBR.operatorLoginErrors.invalidLogin,
        },
      };
      return context.json(body, 400);
    },
  );

  apiRoutes.openapi(deleteSessionRoute, (context) => {
    operatorLogin.logOut(context.req.header('cookie'));
    context.header('Set-Cookie', buildSessionClearingSetCookieHeader());
    return context.json(buildSessionAnswer(operatorLogin, undefined), 200);
  });
}
