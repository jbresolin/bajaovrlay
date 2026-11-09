// "Acertar relógio agora" (BAJAOVRLAY-62): POST /api/v1/server-clock/set-now asks NTP and
// steps the server clock to real time at once, whatever counts time on air. Produtor alone
// (core/operatorLogin/routeAccess.ts). Thin: authorise, call the server clock, answer.
import { ServerClockSetAnswerSchema } from '@bajaovrlay/shared';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import { type ErrorAnswerBody, ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { ptBR } from '../../core/messages/ptBR.js';
import type { OperatorLogin } from '../../core/operatorLogin/operatorLogin.js';
import {
  middlewareForTheAccessOfRoute,
  type RouteAccessOptions,
} from '../../core/operatorLogin/routeAccess.js';
import type { ServerClockControl } from '../../core/time/serverClockControl.js';

const errorAnswerContent = { 'application/json': { schema: ErrorAnswerBodySchema } };

/** `POST /api/v1/server-clock/set-now`: step the server clock to NTP's real time now. */
export const postServerClockSetNowRoute = createRoute({
  method: 'post',
  path: '/server-clock/set-now',
  summary: 'Step the server clock to real time from NTP now ("Acertar relógio agora")',
  description:
    'Asks the NTP servers and steps the server clock to real time at once, even while a ' +
    'race clock runs or a countdown counts on program or preview, which then jump by the ' +
    'difference. The control page asks the producer to confirm first.',
  responses: {
    200: {
      description: 'Stepped; steppedByMs says by how much (positive: forwards).',
      content: { 'application/json': { schema: ServerClockSetAnswerSchema } },
    },
    401: { description: 'With the login on, no session (pt-BR).', content: errorAnswerContent },
    403: { description: 'A Dados session: Produtor only (pt-BR).', content: errorAnswerContent },
    503: {
      description: 'NTP is off on this server, or no NTP server answered (pt-BR).',
      content: errorAnswerContent,
    },
  },
});

/** Who pressed it, for the log: the session's role and station, or the page with no login. */
function describeWhoSetTheClock(
  operatorLogin: OperatorLogin,
  cookieHeader: string | undefined,
): string {
  const session = operatorLogin.findSessionOfCookieHeader(cookieHeader);
  if (session === undefined) {
    return 'operador';
  }
  return `${session.role}:${session.station}`;
}

/** Mounts POST /api/v1/server-clock/set-now with Produtor's access. */
export function mountServerClockRoute(
  apiRoutes: OpenAPIHono<ServerAppEnvironment>,
  options: { serverClockControl: ServerClockControl; routeAccessOptions: RouteAccessOptions },
): void {
  const middleware = middlewareForTheAccessOfRoute(
    postServerClockSetNowRoute,
    options.routeAccessOptions,
  );
  apiRoutes.openapi({ ...postServerClockSetNowRoute, middleware }, async (context) => {
    const actor = describeWhoSetTheClock(
      options.routeAccessOptions.operatorLogin,
      context.req.header('cookie'),
    );
    const outcome = await options.serverClockControl.setToRealTimeNow(actor);
    if (outcome.isSet) {
      return context.json({ steppedByMs: outcome.steppedByMs }, 200);
    }
    const body: ErrorAnswerBody =
      outcome.reason === 'ntpOff'
        ? { error: { code: 'NTP_OFF', message: ptBR.serverClock.ntpOff } }
        : { error: { code: 'NTP_GAVE_NO_ANSWER', message: ptBR.serverClock.noNtpAnswer } };
    return context.json(body, 503);
  });
}
