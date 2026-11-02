/**
 * Refused button polls do not flood the log (apps/server)
 *
 * What this module is for:
 *   A D200 button set up with a wrong id is refused on every poll, for the whole show
 *   (BAJAOVRLAY-56, gate 2). Its "request handled" line is at warn only the first time per
 *   path and status in any 60-second window, and at debug the rest of the time, so the
 *   mistake shows up once a minute instead of on every poll.
 *
 * What these tests prove (through the app, open to the studio network, the clock faked):
 *   - Two mis-set buttons (a mistyped layer, a deleted macro), polled 15 times a second for
 *     2 minutes, write 2 warn lines each, at 0 s and at 60 s; every other line is at debug.
 *   - A refusal for a missing token (401) is held to the same once-a-minute warning, the
 *     access check's own "request refused" line included (it goes to debug for a poll).
 *
 * What these tests deliberately do not cover:
 *   - The window rule in detail (60 s exactly, another status); refusalWarningWindows.test.ts.
 *   - A poll that is answered (debug, always); buttonStateRoutesAccess.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiTokensOfTheDesk } from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import { prepareTheRaceDayWithTheGreenFlagButton } from './buttonStateOnTheApp.testSupport.js';
import {
  type AppWithTheCommandApi,
  createAppWithTheCommandApi,
  sendApiRequest,
} from './commandApiOnTheApp.testSupport.js';

/** A layer id mistyped in Ulanzi Studio. */
const mistypedLayerPath = '/api/v1/state/layer/placar-inexistente';

/** A macro deleted after its D200 button was set up. */
const deletedMacroPath = '/api/v1/state/macro/macro-apagada';

/** 18:00 of the race day, when the polls start. */
const startOfThePolls = new Date('2026-11-14T21:00:00.000Z');

/** The D200 at the rate the brief names: 15 polls each second. */
const pollsPerSecond = 15;

/** Two minutes of polling. */
const secondsOfPolling = 120;

/**
 * Polls each path `pollsPerSecond` times a second for `secondsOfPolling` seconds, moving
 * the faked clock between polls, as a D200 left running with mis-set buttons would.
 */
async function pollForTwoMinutes(app: AppWithTheCommandApi['app'], paths: string[]) {
  const millisecondsBetweenPolls = 1_000 / pollsPerSecond;
  const numberOfPolls = pollsPerSecond * secondsOfPolling;
  for (let pollNumber = 0; pollNumber < numberOfPolls; pollNumber += 1) {
    vi.setSystemTime(startOfThePolls.getTime() + pollNumber * millisecondsBetweenPolls);
    for (const path of paths) {
      await sendApiRequest(app, { method: 'GET', path });
    }
  }
}

/** The "request handled" lines of one path, by level. */
function countRequestHandledLinesByLevel(
  lines: ReturnType<ReturnType<typeof createRecordingLogger>['readRecordedLines']>,
  path: string,
) {
  const linesOfThePath = lines.filter(
    (line) => line.message === 'request handled' && line.path === path,
  );
  return {
    warn: linesOfThePath.filter((line) => line.level === 'warn').length,
    debug: linesOfThePath.filter((line) => line.level === 'debug').length,
    other: linesOfThePath.filter((line) => line.level !== 'warn' && line.level !== 'debug').length,
  };
}

/** Every warn line of the log, whatever wrote it. */
function countWarnLinesOfTheWholeLog(
  lines: ReturnType<ReturnType<typeof createRecordingLogger>['readRecordedLines']>,
) {
  return lines.filter((line) => line.level === 'warn').length;
}

describe('the log of refused button polls', () => {
  afterEach(() => {
    // Every test fakes Date alone; the real clock comes back after each one.
    vi.useRealTimers();
  });

  it('warns twice in two minutes for each mis-set button, at 15 polls a second', async () => {
    // Arrange: the open app logging into memory, the race day, and the clock faked (Date only,
    // so the store and the app keep their real timers).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(startOfThePolls);
    const { logger, readRecordedLines } = createRecordingLogger();
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: undefined,
      isApiOpenToTheNetwork: true,
      logger,
    });
    prepareTheRaceDayWithTheGreenFlagButton(stateStore);

    // Act: both mis-set buttons poll for two minutes.
    await pollForTwoMinutes(app, [mistypedLayerPath, deletedMacroPath]);

    // Assert: each path warned at 0 s and at 60 s, and every other poll is at debug.
    const recordedLines = readRecordedLines();
    const numberOfPolls = pollsPerSecond * secondsOfPolling;
    expect(
      countRequestHandledLinesByLevel(recordedLines, mistypedLayerPath),
      'the mistyped layer: 2 warnings, the rest at debug',
    ).toEqual({ warn: 2, debug: numberOfPolls - 2, other: 0 });
    expect(
      countRequestHandledLinesByLevel(recordedLines, deletedMacroPath),
      'the deleted macro: 2 warnings of its own, the rest at debug',
    ).toEqual({ warn: 2, debug: numberOfPolls - 2, other: 0 });
    expect(
      countWarnLinesOfTheWholeLog(recordedLines),
      'nothing else in the log warned: 2 lines per path',
    ).toBe(4);
  }, 60_000); // 3,600 requests through the real app; under the pinned CI run this can take seconds.

  it('warns twice in two minutes for a poll refused for having no token', async () => {
    // Arrange: the API by token only, the clock faked, and a D200 that sends no header.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(startOfThePolls);
    const { logger, readRecordedLines } = createRecordingLogger();
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
      logger,
    });
    prepareTheRaceDayWithTheGreenFlagButton(stateStore);
    const cornerLayerPath = '/api/v1/state/layer/bug';

    // Act: the button polls for two minutes, refused (401) each time.
    await pollForTwoMinutes(app, [cornerLayerPath]);

    // Assert: the 401 warned at 0 s and at 60 s, the rest at debug, and the access check's
    // own line of each refusal did not warn on its own.
    const recordedLines = readRecordedLines();
    const numberOfPolls = pollsPerSecond * secondsOfPolling;
    expect(
      countRequestHandledLinesByLevel(recordedLines, cornerLayerPath),
      'a refused token: 2 warnings, the rest at debug',
    ).toEqual({ warn: 2, debug: numberOfPolls - 2, other: 0 });
    expect(
      countWarnLinesOfTheWholeLog(recordedLines),
      'nothing else in the log warned, the access check included',
    ).toBe(2);
  }, 60_000);
});
