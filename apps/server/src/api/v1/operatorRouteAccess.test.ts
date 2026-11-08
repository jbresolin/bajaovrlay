/**
 * Which routes need an operator's session, route by route (apps/server)
 *
 * What this module is for:
 *   With the PINs set (BAJAOVRLAY-29) the control page's own reads need a session: GET
 *   /state, the history's older pages, a source's snapshot, "Buscar da fonte", the
 *   simulator's teams and an image upload. Three kinds of caller keep working exactly as
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
 *   - GET /state with `role=renderer` or `role=monitor` answers without a session.
 *   - The history's older pages also answer a device of the command API with its token.
 *   - The command API's routes answer the same with or without a session: 403 with the
 *     API off, as before; a session neither opens nor closes them.
 *   - The session routes, /health, /media/<id> and the OpenAPI document need no session.
 *   - The table has a row for every route of the OpenAPI document, and the access table
 *     in the code names exactly those routes, so a new route must be classed.
 *   - With the login off (no PINs) every page read answers without a session, as before.
 *
 * What these tests deliberately do not cover:
 *   - What each route answers beyond its status; each route has its own tests.
 *   - The WebSocket; core/ws/webSocketHubOperatorSession.test.ts.
 *   - Which commands a role may send; authorizeCommandsByRole.test.ts in core/store.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { companionToken } from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { parseApiTokens } from '../../core/apiAccess/apiTokens.js';
import { createTemporaryDatabasePath } from '../../core/db/temporaryDatabase.testSupport.js';
import {
  createClockMovedByHand,
  createServerAppWithOperatorLogin,
  logInAndKeepTheCookie,
} from '../../core/operatorLogin/operatorLoginOnTheApp.testSupport.js';
import { operatorLoginTurnedOff } from '../../core/operatorLogin/operatorPins.js';
import { accessOfEachApiRoute } from '../../core/operatorLogin/routeAccess.js';

/** A media folder in a new temporary folder, removed when the test ends. */
function createTemporaryMediaFolder(): string {
  const mediaFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-midia-'));
  onTestFinished(() => rmSync(mediaFolder, { recursive: true, force: true }));
  return mediaFolder;
}

/**
 * The server app with the tests' two PINs set, the upload route mounted and, when asked,
 * Companion's token for the command API; with the cookies of Dados at "Mesa 2" and of
 * Produtor at "Mesa 1".
 */
async function createAppWithTheLoginOnAndBothRolesLoggedIn(
  options: { isCompanionsTokenSet?: boolean } = {},
) {
  const apiTokensParsing = parseApiTokens(`companion=${companionToken}`);
  if (!apiTokensParsing.isValid) {
    throw new Error('the test token must parse');
  }
  const { app } = createServerAppWithOperatorLogin({
    databasePath: createTemporaryDatabasePath(),
    clock: createClockMovedByHand(),
    mediaFolder: createTemporaryMediaFolder(),
    apiTokens: options.isCompanionsTokenSet === true ? apiTokensParsing.apiTokens : undefined,
  });
  const dataRoleCookie = await logInAndKeepTheCookie(app, 'dados', 'Mesa 2');
  const producerCookie = await logInAndKeepTheCookie(app, 'produtor', 'Mesa 1');
  return { app, dataRoleCookie, producerCookie };
}

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

/** One request of the table, sent with the cookie (or none, with an empty text). */
function sendTheRowsRequest(
  app: Awaited<ReturnType<typeof createAppWithTheLoginOnAndBothRolesLoggedIn>>['app'],
  request: { path: string; method?: string; json?: unknown },
  cookie: string,
) {
  const headers: Record<string, string> = {};
  if (cookie !== '') {
    headers.cookie = cookie;
  }
  if (request.json !== undefined) {
    headers['content-type'] = 'application/json';
  }
  return app.request(request.path, {
    method: request.method ?? 'GET',
    headers,
    body: request.json === undefined ? undefined : JSON.stringify(request.json),
  });
}

/** A status as the table writes it: the number, or `answered` for the route's own answer. */
function describeStatusAsTheTableDoes(status: number): number | 'answered' {
  const isAnAccessRefusal = status === 401 || status === 403;
  return isAnAccessRefusal ? status : 'answered';
}

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
    expect(
      isAStatusOfItsOwn(expected.noSession, noSessionStatus),
      `${route} with no session`,
    ).toBe(expected.noSession);
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

  const screenReadScenarios = [
    // The renderer page OBS loads, whose hello is late.
    { name: 'answers GET /state?role=renderer with no session', path: '/api/v1/state?role=renderer' },
    // The control page's "Programa" and "Prévia" frames.
    { name: 'answers GET /state?role=monitor with no session', path: '/api/v1/state?role=monitor' },
  ];

  it.each(screenReadScenarios)('$name', async ({ path }) => {
    // Arrange: the login on.
    const { app } = await createAppWithTheLoginOnAndBothRolesLoggedIn();

    // Act: read the state as a screen, with no cookie.
    const response = await app.request(path);

    // Assert: answered, as before the login.
    expect(response.status, 'a screen needs no login on the LAN').toBe(200);
  });

  it('answers the history’s older pages to a device of the command API with its token', async () => {
    // Arrange: the login on, and Companion's token set.
    const { app } = await createAppWithTheLoginOnAndBothRolesLoggedIn({ isCompanionsTokenSet: true });

    // Act: read the history with the token and no cookie.
    const response = await app.request('/api/v1/event-log', {
      headers: { authorization: `Bearer ${companionToken}` },
    });

    // Assert: answered, as before the login.
    expect(response.status, 'a device of the command API keeps its access').toBe(200);
  });

  const filesEveryPageLoads = [
    // The server check of every page, OBS's included.
    { name: 'answers /health with no session', path: '/health', expectedStatus: 200 },
    // The document of the API, for whoever sets a pad up; it holds no state.
    { name: 'answers the OpenAPI document with no session', path: '/api/v1/openapi.json', expectedStatus: 200 },
    // An uploaded image, which a graphic in OBS loads: not found, but never refused.
    {
      name: 'answers an image address with no session (404 for one not uploaded)',
      path: `/media/${'a'.repeat(64)}`,
      expectedStatus: 404,
    },
  ];

  it.each(filesEveryPageLoads)('$name', async ({ path, expectedStatus }) => {
    // Arrange: the login on.
    const { app } = await createAppWithTheLoginOnAndBothRolesLoggedIn();

    // Act: ask for the row's address with no cookie.
    const response = await app.request(path);

    // Assert: the address's own answer, never a refusal for want of a session.
    expect(response.status, `${path} needs no login`).toBe(expectedStatus);
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

describe('the page reads with the login off', () => {
  const pageReads = everyApiRoute.filter((row) => row.expected === sessionRequired);

  it.each(pageReads)('$route answers with no session, as before', async ({ request }) => {
    // Arrange: a server with no PINs set.
    const { app } = createServerAppWithOperatorLogin({
      databasePath: createTemporaryDatabasePath(),
      clock: createClockMovedByHand(),
      operatorPins: operatorLoginTurnedOff,
      mediaFolder: createTemporaryMediaFolder(),
    });

    // Act: send the row's request with no cookie, as the page always has (the history's
    // older pages are read by the page with the browser's same-origin header).
    const response = await app.request(request.path, {
      method: request.method ?? 'GET',
      headers: {
        'sec-fetch-site': 'same-origin',
        ...(request.json === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: request.json === undefined ? undefined : JSON.stringify(request.json),
    });

    // Assert: the route's own answer.
    expect(describeStatusAsTheTableDoes(response.status), 'no login, no refusal').toBe('answered');
  });
});
