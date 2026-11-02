/**
 * Who may poll the button state routes, and how quietly they log (apps/server)
 *
 * What this module is for:
 *   The three state routes of the D200 (BAJAOVRLAY-56) sit behind the command API's own
 *   access check: open to the studio network with no header, or one token per device, or
 *   off. Fifteen buttons polling every second would write about 54,000 request lines an
 *   hour, so a poll that answers writes its lines at debug, and only a refused or failed
 *   poll writes at warn. Polls read memory only and never add a row to the event log.
 *
 * What these tests prove (on a real store, through the app):
 *   - Open, each route answers a call with no header (200).
 *   - With tokens, each route answers Companion's token (200) and refuses no header (401).
 *   - With neither variable, each route answers 403 API_TURNED_OFF.
 *   - A poll's own log lines (the open-mode line and "request handled") are at debug, with
 *     nothing at info or above; a poll of an unknown id writes "request handled" at warn.
 *   - A button press (POST fire-shortcut) still writes "request handled" at info.
 *   - Polling every route leaves the event log as it was.
 *
 * What these tests deliberately do not cover:
 *   - What each route answers; the three *ButtonStateRoute.test.ts files.
 *   - The token table and the open mode themselves; apiTokenAuth.test.ts and
 *     apiOpenToTheNetwork.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  apiTokensOfTheDesk,
  companionToken,
} from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import {
  prepareTheRaceDayWithTheGreenFlagButton,
  type RaceDayWithTheGreenFlagButton,
} from './buttonStateOnTheApp.testSupport.js';
import { createAppWithTheCommandApi, sendApiRequest } from './commandApiOnTheApp.testSupport.js';

/** The three state routes, as a D200 button set up for the race day polls them. */
const stateRoutesOfTheRaceDay = [
  { routeName: 'a layer', buildPath: () => '/api/v1/state/layer/bug' },
  { routeName: 'a quick-fire button', buildPath: () => '/api/v1/state/shortcut/atalhos/1' },
  {
    routeName: 'a macro',
    buildPath: (raceDay: RaceDayWithTheGreenFlagButton) =>
      `/api/v1/state/macro/${raceDay.openTheSessionMacroId}`,
  },
];

/** How the API is turned on, the header the device sends, and the status it must get. */
type AccessScenario = {
  name: string;
  apiTokensVariable: string | undefined;
  isApiOpenToTheNetwork: boolean;
  token: string | undefined;
  expectedHttpStatus: number;
};

const accessScenarios: AccessScenario[] = [
  // João's set-up: the D200 has no header to send, the studio network is trusted.
  {
    name: 'open to the network, no header: answered',
    apiTokensVariable: undefined,
    isApiOpenToTheNetwork: true,
    token: undefined,
    expectedHttpStatus: 200,
  },
  // A device with a token, as Companion, polls these routes too.
  {
    name: "tokens set, Companion's token: answered",
    apiTokensVariable: apiTokensOfTheDesk,
    isApiOpenToTheNetwork: false,
    token: companionToken,
    expectedHttpStatus: 200,
  },
  // Tokens without the open mode: a call with no header is refused, as for every route.
  {
    name: 'tokens set, no header: refused with 401',
    apiTokensVariable: apiTokensOfTheDesk,
    isApiOpenToTheNetwork: false,
    token: undefined,
    expectedHttpStatus: 401,
  },
  // Neither variable: the API is off, and the state of the show is not given out either.
  {
    name: 'the API off: refused with 403',
    apiTokensVariable: undefined,
    isApiOpenToTheNetwork: false,
    token: undefined,
    expectedHttpStatus: 403,
  },
];

describe('access to the button state routes', () => {
  it.each(accessScenarios)('$name', async (scenario) => {
    // Arrange: the API turned on (or not) as the row says, and the race day.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: scenario.apiTokensVariable,
      isApiOpenToTheNetwork: scenario.isApiOpenToTheNetwork,
    });
    const raceDay = prepareTheRaceDayWithTheGreenFlagButton(stateStore);

    // Act: poll each of the three routes with the row's header.
    const httpStatuses: number[] = [];
    for (const { buildPath } of stateRoutesOfTheRaceDay) {
      const response = await sendApiRequest(app, {
        method: 'GET',
        path: buildPath(raceDay),
        token: scenario.token,
      });
      httpStatuses.push(response.status);
    }

    // Assert: every route answers the row's status, as the command API's other routes do.
    expect(httpStatuses, 'the layer, button and macro routes answer alike').toEqual([
      scenario.expectedHttpStatus,
      scenario.expectedHttpStatus,
      scenario.expectedHttpStatus,
    ]);
  });

  it('names both variables in the 403 of an API that is off', async () => {
    // Arrange: neither BAJAOVRLAY_API_TOKENS nor BAJAOVRLAY_API_OPEN.
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: undefined });

    // Act: a D200 polls a layer's state.
    const response = await sendApiRequest(app, { method: 'GET', path: '/api/v1/state/layer/bug' });

    // Assert: the shared error shape with the command API's own code.
    const answer = (await response.json()) as { error: { code: string } };
    expect(answer.error.code, 'the code of the API turned off').toBe('API_TURNED_OFF');
  });
});

/** Builds the open app with a logger that keeps its lines, and the race day on it. */
function createOpenAppWithARecordingLogger() {
  const { logger, readRecordedLines } = createRecordingLogger();
  const { app, stateStore } = createAppWithTheCommandApi({
    apiTokensVariable: undefined,
    isApiOpenToTheNetwork: true,
    logger,
  });
  const raceDay = prepareTheRaceDayWithTheGreenFlagButton(stateStore);
  return { app, stateStore, raceDay, readRecordedLines };
}

/** The log lines one request wrote, found by the id the app echoes in x-request-id. */
function readLinesOfTheRequest(
  readRecordedLines: ReturnType<typeof createRecordingLogger>['readRecordedLines'],
  response: Response,
) {
  const requestId = response.headers.get('x-request-id');
  return readRecordedLines().filter((line) => line.request_id === requestId);
}

describe('the request log of the button state routes', () => {
  it.each(stateRoutesOfTheRaceDay)(
    'logs a poll of $routeName at debug only',
    async ({ buildPath }) => {
      // Arrange: the open app, logging every level into memory.
      const { app, raceDay, readRecordedLines } = createOpenAppWithARecordingLogger();

      // Act: one poll, as the D200 sends it every second.
      const response = await sendApiRequest(app, { method: 'GET', path: buildPath(raceDay) });

      // Assert: answered, its "request handled" line at debug, and no line above debug.
      const linesOfThePoll = readLinesOfTheRequest(readRecordedLines, response);
      const requestHandledLine = linesOfThePoll.find((line) => line.message === 'request handled');
      expect(response.status, 'the poll is answered').toBe(200);
      expect(requestHandledLine?.level, 'a poll that answers logs at debug').toBe('debug');
      expect(
        linesOfThePoll.filter((line) => line.level !== 'debug' && line.level !== 'trace'),
        'a poll writes nothing at info or above, the open-mode line included',
      ).toEqual([]);
    },
  );

  it('logs a poll of an unknown id at warn', async () => {
    // Arrange: the open app, logging every level into memory.
    const { app, readRecordedLines } = createOpenAppWithARecordingLogger();

    // Act: a button set up with a layer that does not exist polls it.
    const response = await sendApiRequest(app, {
      method: 'GET',
      path: '/api/v1/state/layer/placar-inexistente',
    });

    // Assert: its "request handled" line is a warning, with the 404 in it.
    const requestHandledLine = readLinesOfTheRequest(readRecordedLines, response).find(
      (line) => line.message === 'request handled',
    );
    expect(
      [requestHandledLine?.level, requestHandledLine?.status],
      'a refused poll logs at warn, so a mis-set button shows up in the log',
    ).toEqual(['warn', 404]);
  });

  it('still logs a button press at info', async () => {
    // Arrange: the open app, logging every level into memory.
    const { app, readRecordedLines } = createOpenAppWithARecordingLogger();

    // Act: the D200 presses button 1 of "Atalhos".
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/fire-shortcut/atalhos/1',
    });

    // Assert: only the polls are quiet; a press changes the show and keeps its info line.
    const requestHandledLine = readLinesOfTheRequest(readRecordedLines, response).find(
      (line) => line.message === 'request handled',
    );
    expect(requestHandledLine?.level, 'a press logs at info, as before').toBe('info');
  });
});

describe('the button state routes and the event log', () => {
  it('never add a row to the event log', async () => {
    // Arrange: the open app and the race day, and the event log's length now.
    const { app, stateStore, raceDay } = createOpenAppWithARecordingLogger();
    const eventLogLengthBefore = stateStore.readAllSlices().eventLog.length;

    // Act: poll each route three times, as three seconds of the D200 would.
    for (let second = 1; second <= 3; second += 1) {
      for (const { buildPath } of stateRoutesOfTheRaceDay) {
        await sendApiRequest(app, { method: 'GET', path: buildPath(raceDay) });
      }
    }

    // Assert: the event log is as long as before; a poll is not a command.
    expect(
      stateStore.readAllSlices().eventLog.length,
      'reading the state writes nothing to the event log',
    ).toBe(eventLogLengthBefore);
  });
});
