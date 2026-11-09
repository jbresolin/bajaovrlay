/**
 * Which routes need an operator's session, route by route (apps/server)
 *
 * What this module is for:
 *   With the PINs set (BAJAOVRLAY-29) the control page's own reads need a session: GET
 *   /state, the history's older pages, a source's snapshot, "Buscar da fonte", the
 *   simulator's teams, an image upload, and the backup download and its summary
 *   (BAJAOVRLAY-33). Three kinds of caller keep working exactly as
 *   before, with no login: renderer pages (OBS's, and the control page's monitor frames),
 *   which read GET /state with their role; the command API (BAJAOVRLAY-28), which keeps
 *   its tokens and its open mode; and the files every page loads (health, images,
 *   graphics, the theme, the pages themselves). The session routes are open, since they
 *   are how a page gets a session. The access of every /api/v1 route is written once, in
 *   core/operatorLogin/routeAccess.ts, and each route takes its middleware from there.
 *
 * What these tests prove (one table, one row per route, each asked with no session, as
 *   Dados and as Produtor):
 *   - The page's reads answer 401 SESSION_REQUIRED in pt-BR without a session, and are
 *     answered for both roles: Dados reads everything, it only may not send some commands.
 *   - "Acertar relógio agora" answers 401 without a session and 403 for Dados (Produtor
 *     only, since it makes what counts time on air jump), and is answered for Produtor.
 *   - The command API's routes answer the same with or without a session: 403 with the
 *     API off, as before; a session neither opens nor closes them.
 *   - The session routes need no session.
 *   - The table has a row for every route of the OpenAPI document, and the access table
 *     in the code names exactly those routes, so a new route must be classed.
 *
 * What these tests deliberately do not cover:
 *   - A screen's read of GET /state, a device's read of the history, the addresses outside
 *     /api/v1, and the login off; operatorRouteAccessOutsideTheTable.test.ts.
 *   - What each route answers beyond its status; each route has its own tests.
 *   - The WebSocket; core/ws/webSocketHubOperatorSession.test.ts.
 *   - Which commands a role may send; authorizeCommandsByRole.test.ts in core/store.
 */
import { describe, expect, it } from 'vitest';

import { accessOfEachApiRoute } from '../../core/operatorLogin/routeAccess.js';
import {
  createAppWithTheLoginOnAndBothRolesLoggedIn,
  describeStatusAsTheTableDoes,
  sendTheRowsRequest,
} from './routeAccessOnTheApp.testSupport.js';

/** What the three callers of a row get back: a status, or the route's own answer. */
type ExpectedForEachCaller = {
  noSession: number | 'answered';
  dados: number | 'answered';
  produtor: number | 'answered';
};

/** One row of the table: the route's key, the request sent, and what each caller gets. */
type RouteRow = {
  route: string;
  request: { path: string; method?: string; json?: unknown };
  expected: ExpectedForEachCaller;
};

// What the three callers of each row get back.
const sessionRequired: ExpectedForEachCaller = {
  noSession: 401,
  dados: 'answered',
  produtor: 'answered',
};
const sameForEveryone = (status: number): ExpectedForEachCaller => ({
  noSession: status,
  dados: status,
  produtor: status,
});

/**
 * Every route under /api/v1, keyed as the access table keys it (`<METHOD> <path>`), with
 * the request a test sends and what each caller gets: a status, or `answered` when the
 * route's own answer comes back (anything but 401 and 403), whatever its own status is.
 */
const everyApiRoute: RouteRow[] = [
  // --- The control page's reads: a session, either role. ---
  // Every slice: the page's fallback, and anyone's look at the server.
  { route: 'GET /state', request: { path: '/api/v1/state' }, expected: sessionRequired },
  // The history's older pages (BAJAOVRLAY-30).
  { route: 'GET /event-log', request: { path: '/api/v1/event-log' }, expected: sessionRequired },
  // A source's latest data; the seeded simulator has none yet, so the route itself says 404.
  {
    route: 'GET /data-sources/{sourceId}/snapshot',
    request: { path: '/api/v1/data-sources/simulador-enduro/snapshot' },
    expected: sessionRequired,
  },
  // "Buscar da fonte": an empty body, which the route itself refuses with 400.
  {
    route: 'POST /data-sources/http-json/sample-request',
    request: { path: '/api/v1/data-sources/http-json/sample-request', method: 'POST', json: {} },
    expected: sessionRequired,
  },
  // "Importar equipes do simulador".
  {
    route: 'GET /entities/simulator-teams',
    request: { path: '/api/v1/entities/simulator-teams' },
    expected: sessionRequired,
  },
  // An image upload from Cadastros; with no file the route itself says 400.
  {
    route: 'POST /media',
    request: { path: '/api/v1/media', method: 'POST', json: {} },
    expected: sessionRequired,
  },
  // "Cópia de segurança": Dados may download a backup too, since it changes nothing on air.
  // A query the route refuses with 400, so no zip is streamed for the test.
  {
    route: 'GET /backup',
    request: { path: '/api/v1/backup?includeRecordings=talvez' },
    expected: sessionRequired,
  },
  // What the dialog shows before "Baixar".
  {
    route: 'GET /backup/summary',
    request: { path: '/api/v1/backup/summary' },
    expected: sessionRequired,
  },

  // --- Produtor only: an action that changes the air (BAJAOVRLAY-62). ---
  // "Acertar relógio agora": Dados gets 403; Produtor gets the route's own answer, here
  // 503 since the test server has NTP off.
  {
    route: 'POST /server-clock/set-now',
    request: { path: '/api/v1/server-clock/set-now', method: 'POST' },
    expected: { noSession: 401, dados: 403, produtor: 'answered' },
  },

  // --- The session routes: open, they are how a page gets a session. ---
  { route: 'GET /session', request: { path: '/api/v1/session' }, expected: sameForEveryone(200) },
  // A login with no body: refused by its schema, never by a missing session.
  {
    route: 'POST /session',
    request: { path: '/api/v1/session', method: 'POST', json: {} },
    expected: sameForEveryone(400),
  },
  // "Sair" (sent last for the logged-in callers' rows: see the test below).
  {
    route: 'DELETE /session',
    request: { path: '/api/v1/session', method: 'DELETE' },
    expected: sameForEveryone(200),
  },

  // --- The command API: its tokens decide, never a session; off here, so 403. ---
  {
    route: 'POST /commands',
    request: { path: '/api/v1/commands', method: 'POST', json: { type: 'command' } },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /take-next',
    request: { path: '/api/v1/take-next', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /take-item/{itemId}',
    request: { path: '/api/v1/take-item/item-relogio', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /preview-item/{itemId}',
    request: { path: '/api/v1/preview-item/item-relogio', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /take-all-previews',
    request: { path: '/api/v1/take-all-previews', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /clear-layer/{layerId}',
    request: { path: '/api/v1/clear-layer/clock', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /clear-all',
    request: { path: '/api/v1/clear-all', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /next-on-layer/{layerId}',
    request: { path: '/api/v1/next-on-layer/fullscreen', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /run-macro/{macroId}',
    request: { path: '/api/v1/run-macro/macro-abertura', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /fire-shortcut/{panelId}/{buttonNumber}',
    request: { path: '/api/v1/fire-shortcut/atalhos/1', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /stop-macro',
    request: { path: '/api/v1/stop-macro', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /obs-scene/{sceneName}',
    request: { path: '/api/v1/obs-scene/Pista', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /undo-layer/{layerId}',
    request: { path: '/api/v1/undo-layer/clock', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /undo-last',
    request: { path: '/api/v1/undo-last', method: 'POST' },
    expected: sameForEveryone(403),
  },
  {
    route: 'GET /layers/status',
    request: { path: '/api/v1/layers/status' },
    expected: sameForEveryone(403),
  },
  {
    route: 'POST /triggers/{triggerId}',
    request: { path: '/api/v1/triggers/gatilho-largada', method: 'POST', json: {} },
    expected: sameForEveryone(403),
  },
  {
    route: 'GET /state/layer/{layerId}',
    request: { path: '/api/v1/state/layer/clock' },
    expected: sameForEveryone(403),
  },
  {
    route: 'GET /state/shortcut/{panelId}/{buttonNumber}',
    request: { path: '/api/v1/state/shortcut/atalhos/1' },
    expected: sameForEveryone(403),
  },
  {
    route: 'GET /state/macro/{macroId}',
    request: { path: '/api/v1/state/macro/macro-abertura' },
    expected: sameForEveryone(403),
  },
];

describe('the access of every /api/v1 route with the login on', () => {
  it.each(everyApiRoute)('$route', async ({ route, request, expected }) => {
    // Arrange: the login on, and the cookies of Dados and of Produtor.
    const { app, dataRoleCookie, producerCookie } =
      await createAppWithTheLoginOnAndBothRolesLoggedIn();

    // Act: send the row's request with no session, as Dados and as Produtor ("Sair" ends
    // the session it is sent with, so it goes last).
    const noSessionStatus = (await sendTheRowsRequest(app, request, '')).status;
    const dataRoleStatus = (await sendTheRowsRequest(app, request, dataRoleCookie)).status;
    const producerStatus = (await sendTheRowsRequest(app, request, producerCookie)).status;

    // Assert: each caller gets what the row says.
    const isAStatusOfItsOwn = (expectedStatus: number | 'answered', actualStatus: number) =>
      expectedStatus === 'answered' ? describeStatusAsTheTableDoes(actualStatus) : actualStatus;
    expect(isAStatusOfItsOwn(expected.noSession, noSessionStatus), `${route} with no session`).toBe(
      expected.noSession,
    );
    expect(isAStatusOfItsOwn(expected.dados, dataRoleStatus), `${route} as Dados`).toBe(
      expected.dados,
    );
    expect(isAStatusOfItsOwn(expected.produtor, producerStatus), `${route} as Produtor`).toBe(
      expected.produtor,
    );
  });

  it('answers a page read without a session with 401 and a pt-BR sentence', async () => {
    // Arrange: the login on.
    const { app } = await createAppWithTheLoginOnAndBothRolesLoggedIn();

    // Act: read every slice with no cookie.
    const response = await app.request('/api/v1/state');
    const body: unknown = await response.json();

    // Assert: 401, and what to do, in pt-BR.
    expect(response.status, 'a page read needs a session').toBe(401);
    expect(body, 'the refusal says to log in').toEqual({
      error: {
        code: 'SESSION_REQUIRED',
        message: 'Entre com o seu papel e PIN para usar esta página.',
      },
    });
  });
});

describe('the access table itself', () => {
  it('names exactly the routes of the OpenAPI document, and this test has a row for each', async () => {
    // Arrange: the server app, and the routes its OpenAPI document lists.
    const { app } = await createAppWithTheLoginOnAndBothRolesLoggedIn();
    const openApiDocument = (await (await app.request('/api/v1/openapi.json')).json()) as {
      paths: Record<string, Record<string, unknown>>;
    };

    // Act: key every route of the document as the access table does.
    const routesOfTheDocument: string[] = [];
    for (const [path, operations] of Object.entries(openApiDocument.paths)) {
      for (const method of Object.keys(operations)) {
        routesOfTheDocument.push(`${method.toUpperCase()} ${path}`);
      }
    }

    // Assert: the code's table and this test's table both list the same routes.
    expect(
      Object.keys(accessOfEachApiRoute).sort(),
      'every route must be classed in core/operatorLogin/routeAccess.ts',
    ).toEqual([...routesOfTheDocument].sort());
    expect(
      everyApiRoute.map((row) => row.route).sort(),
      'every route must have a row in this test',
    ).toEqual([...routesOfTheDocument].sort());
  });
});
