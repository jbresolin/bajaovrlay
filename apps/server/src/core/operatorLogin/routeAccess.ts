import type { MiddlewareHandler } from 'hono';

import { allowTheControlPageOrRequireApiAccess } from '../apiAccess/allowTheControlPageOrRequireApiAccess.js';
import type { ApiTokens } from '../apiAccess/apiTokens.js';
import { requireApiAccess } from '../apiAccess/requireApiAccess.js';
import type { ErrorAnswerBody } from '../http/errorAnswers.js';
import type { ServerAppEnvironment } from '../http/httpContextVariables.js';
import { ptBR } from '../messages/ptBR.js';
import type { OperatorLogin } from './operatorLogin.js';

/**
 * Who may call a route under /api/v1 (BAJAOVRLAY-29):
 * - `open`: anyone; the session routes, which are how a page gets a session;
 * - `operatorSession`: the control page's reads, with a session of either role while the
 *   login is on, anyone while it is off;
 * - `operatorSessionUnlessAScreen`: GET /state, the same, except that a renderer page
 *   asking with `role=renderer` or `role=monitor` needs no session, as on the WebSocket;
 * - `operatorSessionOrCommandApi`: the history's older pages, read by the page with its
 *   session and by a device through the command API's access;
 * - `commandApi`: the command API (BAJAOVRLAY-28), behind its tokens and its open mode
 *   only; mountCommandApiRoutes and mountButtonStateRoutes put that check on each route.
 */
export type RouteAccess =
  | 'open'
  | 'operatorSession'
  | 'operatorSessionUnlessAScreen'
  | 'operatorSessionOrCommandApi'
  | 'commandApi';

/**
 * The access table: every route under /api/v1, keyed `<METHOD> <path>` as the OpenAPI
 * document writes it, written once. The page's routes take their middleware from here
 * (middlewareForTheAccessOfRoute); operatorRouteAccess.test.ts checks every row with no
 * session, as Dados and as Produtor, and that the table names exactly the document's routes.
 * Not in it, and open to everyone: /health, /media/<id>, /graphics/, /theme/, /render/,
 * the control page's own files and /api/v1/openapi.json; and /ws, whose rule is the
 * hub's (core/ws/connectionActor.ts).
 */
export const accessOfEachApiRoute = {
  'GET /session': 'open',
  'POST /session': 'open',
  'DELETE /session': 'open',
  'GET /state': 'operatorSessionUnlessAScreen',
  'GET /event-log': 'operatorSessionOrCommandApi',
  'GET /data-sources/{sourceId}/snapshot': 'operatorSession',
  'POST /data-sources/http-json/sample-request': 'operatorSession',
  'GET /entities/simulator-teams': 'operatorSession',
  'POST /media': 'operatorSession',
  'POST /commands': 'commandApi',
  'POST /take-next': 'commandApi',
  'POST /take-item/{itemId}': 'commandApi',
  'POST /preview-item/{itemId}': 'commandApi',
  'POST /take-all-previews': 'commandApi',
  'POST /clear-layer/{layerId}': 'commandApi',
  'POST /clear-all': 'commandApi',
  'POST /next-on-layer/{layerId}': 'commandApi',
  'POST /run-macro/{macroId}': 'commandApi',
  'POST /fire-shortcut/{panelId}/{buttonNumber}': 'commandApi',
  'POST /stop-macro': 'commandApi',
  'POST /obs-scene/{sceneName}': 'commandApi',
  'POST /undo-layer/{layerId}': 'commandApi',
  'POST /undo-last': 'commandApi',
  'GET /layers/status': 'commandApi',
  'POST /triggers/{triggerId}': 'commandApi',
  'GET /state/layer/{layerId}': 'commandApi',
  'GET /state/shortcut/{panelId}/{buttonNumber}': 'commandApi',
  'GET /state/macro/{macroId}': 'commandApi',
} as const satisfies Record<string, RouteAccess>;

/** A route of the table, by its key. */
export type ApiRouteKey = keyof typeof accessOfEachApiRoute;

/** What the access middleware needs: the login, and the command API's settings. */
export type RouteAccessOptions = {
  operatorLogin: OperatorLogin;
  apiTokens: ApiTokens;
  isOpenToTheNetwork: boolean;
};

// The two `role` values that make a GET /state a screen's read.
const screenRolesOfTheStateRoute = ['renderer', 'monitor'];

/** Whether a text is a key of the access table. */
function isRouteKeyOfTheTable(routeKey: string): routeKey is ApiRouteKey {
  return Object.hasOwn(accessOfEachApiRoute, routeKey);
}

/**
 * The middleware of one route declared with createRoute, from its row of the table (keyed
 * by the route's own method and path, so no key is typed twice): none for `open` (and for
 * `commandApi`, whose own mount adds requireApiAccess), the session check otherwise. A
 * route missing from the table stops the boot, so none can go out unclassed.
 */
export function middlewareForTheAccessOfRoute(
  route: { method: string; path: string },
  options: RouteAccessOptions,
): MiddlewareHandler<ServerAppEnvironment>[] {
  const routeKey = `${route.method.toUpperCase()} ${route.path}`;
  if (!isRouteKeyOfTheTable(routeKey)) {
    throw new Error(`the route ${routeKey} is not in the access table (routeAccess.ts)`);
  }
  const access: RouteAccess = accessOfEachApiRoute[routeKey];
  switch (access) {
    case 'open':
    case 'commandApi':
      return [];
    case 'operatorSession':
      return [requireOperatorSession(options.operatorLogin, () => false)];
    case 'operatorSessionUnlessAScreen':
      return [
        requireOperatorSession(options.operatorLogin, (role) =>
          screenRolesOfTheStateRoute.includes(role ?? ''),
        ),
      ];
    case 'operatorSessionOrCommandApi':
      return [requireOperatorSessionOrTheCommandApi(options)];
  }
}

/** The 401 a page read without a session gets while the login is on. */
function answerSessionRequired(
  context: Parameters<MiddlewareHandler<ServerAppEnvironment>>[0],
): Response {
  const body: ErrorAnswerBody = {
    error: { code: 'SESSION_REQUIRED', message: ptBR.operatorLoginErrors.sessionRequired },
  };
  return context.json(body, 401);
}

/**
 * Lets the request through with a session, or with the login off; also when
 * `isAScreensRead` says yes for the request's `role` query field. Answers 401 otherwise.
 */
function requireOperatorSession(
  operatorLogin: OperatorLogin,
  isAScreensRead: (roleInTheQuery: string | undefined) => boolean,
): MiddlewareHandler<ServerAppEnvironment> {
  return async (context, next) => {
    const session = operatorLogin.findSessionOfCookieHeader(context.req.header('cookie'));
    const isLetThrough =
      !operatorLogin.isLoginRequired ||
      session !== undefined ||
      isAScreensRead(context.req.query('role'));
    if (!isLetThrough) {
      return answerSessionRequired(context);
    }
    await next();
    return undefined;
  };
}

/**
 * The history's older pages. Login off: as before BAJAOVRLAY-29, the page's same-origin
 * fetch or the command API's access. Login on: a session lets the page through; a request
 * with a token, or any request while the API is open to the network, goes through the
 * command API's rules (so a device keeps its access); anything else is 401, which sends a
 * page without a session to "#/entrar".
 */
function requireOperatorSessionOrTheCommandApi(
  options: RouteAccessOptions,
): MiddlewareHandler<ServerAppEnvironment> {
  const accessAsBefore = allowTheControlPageOrRequireApiAccess(options);
  const accessOfTheCommandApi = requireApiAccess(options);
  return async (context, next) => {
    if (!options.operatorLogin.isLoginRequired) {
      return accessAsBefore(context, next);
    }
    const session = options.operatorLogin.findSessionOfCookieHeader(context.req.header('cookie'));
    if (session !== undefined) {
      await next();
      return undefined;
    }
    const hasAToken = context.req.header('authorization') !== undefined;
    if (hasAToken || options.isOpenToTheNetwork) {
      return accessOfTheCommandApi(context, next);
    }
    return answerSessionRequired(context);
  };
}
