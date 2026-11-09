/**
 * "Acertar relógio agora" and "Verificar servidor"'s clock line (apps/server)
 *
 * What this module is for:
 *   The server clock keeps real time from NTP (BAJAOVRLAY-62). While something counts
 *   time on air it does not step a big difference by itself; Produtor can, with
 *   POST /api/v1/server-clock/set-now, after the page's confirm. GET /health says what
 *   the server clock knows of NTP, for "Verificar servidor".
 *
 * What these tests prove (the real app in memory, with a stand-in for the server clock's
 *   NTP, so no test asks the internet):
 *   - set-now answers 200 with how far the clock was stepped.
 *   - With no NTP answer it answers 503 NTP_GAVE_NO_ANSWER in pt-BR; with NTP off, 503
 *     NTP_OFF in pt-BR.
 *   - /health carries the last NTP answer and the offset left; with NTP off it says so.
 *
 * What these tests deliberately do not cover:
 *   - Who may call set-now; operatorRouteAccess.test.ts (Produtor only).
 *   - How the clock is stepped; core/time/serverClockDiscipline.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createServerApp } from '../../core/http/createServerApp.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { operatorLoginOff } from '../../core/operatorLogin/operatorLoginOff.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import {
  type ServerClockControl,
  serverClockWithNtpOff,
} from '../../core/time/serverClockControl.js';
import type { SetToRealTimeOutcome } from '../../core/time/serverClockDiscipline.js';

/** 10 October 2026, 13:00:04 UTC: when the last NTP answer of these tests arrived. */
const momentOfTheLastNtpAnswerMs = Date.parse('2026-10-10T13:00:04.000Z');

/**
 * A stand-in for the server clock on NTP: its last answer came from a.st1.ntp.br, the
 * clock is 2.35 s behind real time, and "Acertar relógio agora" does as `outcome` says.
 */
function createServerClockOnNtpThatAnswers(outcome: SetToRealTimeOutcome): ServerClockControl {
  return {
    readServerClockHealth: () => ({
      isNtpOn: true,
      lastNtpAnswer: {
        serverName: 'a.st1.ntp.br:123',
        atMs: momentOfTheLastNtpAnswerMs,
        differenceMs: 2_350,
        roundTripMs: 9,
      },
      offFromRealTimeMs: 2_350,
    }),
    readOffFromRealTimeMs: () => 2_350,
    setToRealTimeNow: () => Promise.resolve(outcome),
    stepToRealTimeAtBoot: () => Promise.resolve(),
    stop: () => {},
  };
}

/** The server app as production builds it, on a fresh store, with the given clock control. */
function createServerAppWithTheClock(serverClockControl: ServerClockControl) {
  const logger = createLogger({ level: 'silent' });
  const stateStore = createStateStore({
    database: openTemporaryDatabase().database,
    logger,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
  });
  return createServerApp({
    operatorLogin: operatorLoginOff,
    logger,
    version: '0.3.1',
    stateStore,
    serverClockControl,
  });
}

describe('POST /api/v1/server-clock/set-now', () => {
  it('answers how far the server clock was stepped', async () => {
    // Arrange: NTP answers, and the clock was 2.35 s behind.
    const app = createServerAppWithTheClock(
      createServerClockOnNtpThatAnswers({ isSet: true, steppedByMs: 2_350 }),
    );

    // Act: the producer confirms "Acertar relógio agora".
    const response = await app.request('/api/v1/server-clock/set-now', { method: 'POST' });

    // Assert: 200, stepped 2.35 s forwards.
    expect(response.status, 'the clock was set').toBe(200);
    expect(await response.json(), 'the page says by how much').toEqual({ steppedByMs: 2_350 });
  });

  const refusalScenarios = [
    // The uplink at the track is down: nothing to set the clock to.
    {
      name: 'answers 503 NTP_GAVE_NO_ANSWER when no NTP server answered',
      serverClockControl: createServerClockOnNtpThatAnswers({
        isSet: false,
        reason: 'noAnswer',
        problems: ['a.st1.ntp.br:123: timeout'],
      }),
      expectedError: {
        code: 'NTP_GAVE_NO_ANSWER',
        message: 'Nenhum servidor NTP respondeu; o relógio do servidor ficou como estava.',
      },
    },
    // A server started with BAJAOVRLAY_NTP_SERVERS=off has no real time to go by.
    {
      name: 'answers 503 NTP_OFF on a server with NTP off',
      serverClockControl: serverClockWithNtpOff,
      expectedError: {
        code: 'NTP_OFF',
        message:
          'O NTP está desligado neste servidor (BAJAOVRLAY_NTP_SERVERS=off): não há hora certa para acertar o relógio.',
      },
    },
  ];

  it.each(refusalScenarios)('$name', async ({ serverClockControl, expectedError }) => {
    // Arrange: the server clock as this row says.
    const app = createServerAppWithTheClock(serverClockControl);

    // Act: the producer confirms "Acertar relógio agora".
    const response = await app.request('/api/v1/server-clock/set-now', { method: 'POST' });

    // Assert: 503 with the reason in pt-BR.
    expect(response.status, 'the clock could not be set').toBe(503);
    expect(await response.json(), 'the page shows why').toEqual({ error: expectedError });
  });
});

describe('GET /health and the server clock', () => {
  it('carries the last NTP answer and the offset left', async () => {
    // Arrange: a server clock on NTP, 2.35 s behind.
    const app = createServerAppWithTheClock(
      createServerClockOnNtpThatAnswers({ isSet: true, steppedByMs: 0 }),
    );

    // Act: "Verificar servidor".
    const response = await app.request('/health');

    // Assert: the clock's report beside the version.
    expect(await response.json(), '"Verificar servidor" shows the last answer').toEqual({
      ok: true,
      version: '0.3.1',
      serverClock: {
        isNtpOn: true,
        lastNtpAnswer: {
          serverName: 'a.st1.ntp.br:123',
          atMs: momentOfTheLastNtpAnswerMs,
          differenceMs: 2_350,
          roundTripMs: 9,
        },
        offFromRealTimeMs: 2_350,
      },
    });
  });

  it('says NTP is off on a server started with it off', async () => {
    // Arrange: a server with NTP off.
    const app = createServerAppWithTheClock(serverClockWithNtpOff);

    // Act: "Verificar servidor".
    const response = await app.request('/health');

    // Assert: NTP off.
    expect(await response.json(), 'the page says the clock follows no NTP').toEqual({
      ok: true,
      version: '0.3.1',
      serverClock: { isNtpOn: false },
    });
  });
});
