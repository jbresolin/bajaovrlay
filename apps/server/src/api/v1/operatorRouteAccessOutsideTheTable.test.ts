/**
 * The access of what the table of routes does not decide alone (apps/server)
 *
 * What this module is for:
 *   operatorRouteAccess.test.ts walks every /api/v1 route with the login on (BAJAOVRLAY-29).
 *   Some callers keep working with no session at all, and these tests name them one by one:
 *   renderer pages reading GET /state with their role, a device of the command API reading
 *   the history with its token, and the files every page loads. With the login off (no
 *   PINs) every page read answers with no session, as it did before the login existed.
 *
 * What these tests prove:
 *   - GET /state with `role=renderer` or `role=monitor` answers without a session.
 *   - The history's older pages answer a device of the command API with its token.
 *   - /health, /media/<id> and the OpenAPI document need no session.
 *   - With the login off, each of the six page reads answers without a session.
 *
 * What these tests deliberately do not cover:
 *   - Each route with no session, as Dados and as Produtor; operatorRouteAccess.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { companionToken } from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { createTemporaryDatabasePath } from '../../core/db/temporaryDatabase.testSupport.js';
import {
  createClockMovedByHand,
  createServerAppWithOperatorLogin,
} from '../../core/operatorLogin/operatorLoginOnTheApp.testSupport.js';
import { operatorLoginTurnedOff } from '../../core/operatorLogin/operatorPins.js';
import {
  createAppWithTheLoginOnAndBothRolesLoggedIn,
  createTemporaryMediaFolder,
  describeStatusAsTheTableDoes,
} from './routeAccessOnTheApp.testSupport.js';

describe('callers that need no session with the login on', () => {
  const screenReadScenarios = [
    // The renderer page OBS loads, whose hello is late.
    {
      name: 'answers GET /state?role=renderer with no session',
      path: '/api/v1/state?role=renderer',
    },
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
    const { app } = await createAppWithTheLoginOnAndBothRolesLoggedIn({
      isCompanionsTokenSet: true,
    });

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
    {
      name: 'answers the OpenAPI document with no session',
      path: '/api/v1/openapi.json',
      expectedStatus: 200,
    },
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

describe('the page reads with the login off', () => {
  const pageReads = [
    // Every slice.
    { route: 'GET /state', request: { path: '/api/v1/state' } },
    // The history's older pages, read by the page with the browser's same-origin header.
    { route: 'GET /event-log', request: { path: '/api/v1/event-log' } },
    // A source's latest data (the route's own 404 here: the simulator has none yet).
    {
      route: 'GET /data-sources/{sourceId}/snapshot',
      request: { path: '/api/v1/data-sources/simulador-enduro/snapshot' },
    },
    // "Buscar da fonte" with an empty body (the route's own 400).
    {
      route: 'POST /data-sources/http-json/sample-request',
      request: { path: '/api/v1/data-sources/http-json/sample-request', method: 'POST', json: {} },
    },
    // "Importar equipes do simulador".
    {
      route: 'GET /entities/simulator-teams',
      request: { path: '/api/v1/entities/simulator-teams' },
    },
    // An upload with no file (the route's own 400).
    { route: 'POST /media', request: { path: '/api/v1/media', method: 'POST', json: {} } },
  ];

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
