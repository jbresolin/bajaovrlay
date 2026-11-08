/**
 * Bringing the server clock back to the wall clock, a little at a time (apps/server)
 *
 * What this module is for:
 *   The server clock counts on monotonic time, so a step of the wall clock does not move
 *   it. Over hours, though, the two drift apart by small amounts, and a time sync that
 *   corrects the wall clock leaves a difference too. Once a minute the re-anchoring
 *   measures that drift and logs it. When no clock is running on any output it moves
 *   the server clock towards the wall clock, by 50 ms at most, so nothing on screen
 *   jumps; while a clock runs it only logs the drift and moves nothing.
 *
 * What these tests prove (with a real store and the built race clock, on Vitest's fake
 *   Date, performance and interval timers):
 *   - Nothing on air and the wall clock 300 ms ahead: one check moves the server clock
 *     50 ms; six checks bring it to the wall clock, and then it stays.
 *   - The wall clock 300 ms behind: the same, the other way.
 *   - A step of 5 s is still covered 50 ms at a time, and logged as a warning.
 *   - A race clock running on air: the drift is logged, the server clock not moved. Once
 *     the operator stops the clock, the next check moves it.
 *   - A race clock held on air (not running) does not stop the re-anchoring.
 *   - No drift: nothing is moved and nothing logged.
 *   - stop() ends the checks.
 *
 * What these tests deliberately do not cover:
 *   - The server clock itself; serverClock.test.ts.
 *   - Graphics other than the race clock: a clock is found by the four clock roles its
 *     manifest marks (findClockFieldKeysByRole), never by a graphic's name.
 */
import { describe, expect, it, vi } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  createStoreOnAServerClock,
  fakeTheMachineClocksAtTenOClock,
  stepTheWallClockBy,
  stopTheClockOnAir,
  takeTheEnduroClockOnAir,
} from './serverClockOnTheStore.testSupport.js';
import {
  largestReanchorStepInMilliseconds,
  reanchorIntervalInMilliseconds,
  startServerClockReanchoring,
} from './serverClockReanchoring.js';

/**
 * Builds a store on a server clock at ten o'clock, with the re-anchoring started on it
 * and logging into memory.
 */
function startReanchoringOnAStore() {
  fakeTheMachineClocksAtTenOClock();
  const { serverClock, store } = createStoreOnAServerClock();
  const { logger, readRecordedLines } = createRecordingLogger();
  const reanchoring = startServerClockReanchoring({
    serverClock,
    readAllSlices: store.readAllSlices,
    logger,
  });
  /** The re-anchoring's own log lines: the ones that carry a drift. */
  const readReanchorLogLines = () =>
    readRecordedLines()
      .filter((line) => line.drift_ms !== undefined)
      .map((line) => ({
        level: line.level,
        message: line.message,
        drift_ms: line.drift_ms,
        moved_ms: line.moved_ms,
      }));
  return { serverClock, store, reanchoring, readReanchorLogLines };
}

/** Lets the given number of one-minute checks happen. */
function letChecksHappen(numberOfChecks: number): void {
  vi.advanceTimersByTime(numberOfChecks * reanchorIntervalInMilliseconds);
}

describe('re-anchoring the server clock', () => {
  it('waits a minute between checks and moves at most 50 ms at once', () => {
    // Arrange: nothing to set up; the rule's two numbers are what is checked.

    // Act: read them.
    const numbersOfTheRule = [reanchorIntervalInMilliseconds, largestReanchorStepInMilliseconds];

    // Assert: one minute between checks, 50 ms at most per check.
    expect(numbersOfTheRule, 'the rule is: once a minute, never more than 50 ms').toEqual([
      60_000, 50,
    ]);
  });

  const driftScenarios = [
    // A time sync stepped the wall clock forwards: the server clock is behind.
    { name: 'catches up 300 ms on a wall clock that went ahead', stepMs: 300, movedMs: 50 },
    // A time sync stepped it back, as #52 saw under load: the server clock is ahead.
    { name: 'drops back 300 ms behind a wall clock that went back', stepMs: -300, movedMs: -50 },
  ];

  for (const scenario of driftScenarios) {
    it(`${scenario.name}, 50 ms per check, while nothing is on air`, () => {
      // Arrange: an empty air, and the wall clock stepped by 300 ms.
      const { serverClock, readReanchorLogLines } = startReanchoringOnAStore();
      stepTheWallClockBy(scenario.stepMs);

      // Act: one check, then five more.
      letChecksHappen(1);
      const driftAfterOneCheckMs = serverClock.measureDriftFromWallClockMs();
      letChecksHappen(5);
      const driftAfterSixChecksMs = serverClock.measureDriftFromWallClockMs();
      letChecksHappen(1);

      // Assert: 250 ms left after one check, none after six; the first check's log line
      // names the drift it found and what it moved, and the seventh logs nothing.
      expect(driftAfterOneCheckMs, 'one check must cover 50 ms of the drift').toBe(
        scenario.stepMs - scenario.movedMs,
      );
      expect(driftAfterSixChecksMs, 'six checks must cover all 300 ms').toBe(0);
      const logLines = readReanchorLogLines();
      expect(logLines[0], 'the first check must log the drift and the move').toEqual({
        level: 'info',
        message: 'server clock re-anchored towards the wall clock',
        drift_ms: scenario.stepMs,
        moved_ms: scenario.movedMs,
      });
      expect(logLines, 'six checks with drift, and none once it is gone').toHaveLength(6);
    });
  }

  it('covers a 5 s step 50 ms at a time too, and logs it as a warning', () => {
    // Arrange: an empty air, and the wall clock stepped forwards by 5 s.
    const { serverClock, readReanchorLogLines } = startReanchoringOnAStore();
    stepTheWallClockBy(5_000);

    // Act: one check.
    letChecksHappen(1);

    // Assert: still only 50 ms moved; a drift past a second is logged as a warning, since
    // it is more than drift (someone set the machine's clock, or the sync is failing).
    expect(
      serverClock.measureDriftFromWallClockMs(),
      'even a large drift must be covered 50 ms at a time',
    ).toBe(4_950);
    expect(readReanchorLogLines(), 'a drift over a second must be a warning').toEqual([
      {
        level: 'warn',
        message: 'server clock re-anchored towards the wall clock',
        drift_ms: 5_000,
        moved_ms: 50,
      },
    ]);
  });

  it('holds the server clock while a race clock runs on air, and moves it once stopped', () => {
    // Arrange: the enduro clock running on air, and the wall clock 300 ms ahead.
    const { serverClock, store, readReanchorLogLines } = startReanchoringOnAStore();
    takeTheEnduroClockOnAir(store, { isRunning: true });
    stepTheWallClockBy(300);

    // Act: two checks with the clock running; then the operator stops it, and one more.
    letChecksHappen(2);
    const driftWhileRunningMs = serverClock.measureDriftFromWallClockMs();
    stopTheClockOnAir(store);
    letChecksHappen(1);
    const driftAfterTheStopMs = serverClock.measureDriftFromWallClockMs();

    // Assert: nothing moved while the clock ran, though each check logged the drift; the
    // first check after the stop moved 50 ms.
    expect(driftWhileRunningMs, 'a running clock on air must hold the server clock').toBe(300);
    expect(driftAfterTheStopMs, 'once stopped, the next check must move 50 ms').toBe(250);
    expect(readReanchorLogLines(), 'two holds logged, then the move').toEqual([
      {
        level: 'info',
        message: 'server clock drift held: a clock is running',
        drift_ms: 300,
        moved_ms: undefined,
      },
      {
        level: 'info',
        message: 'server clock drift held: a clock is running',
        drift_ms: 300,
        moved_ms: undefined,
      },
      {
        level: 'info',
        message: 'server clock re-anchored towards the wall clock',
        drift_ms: 300,
        moved_ms: 50,
      },
    ]);
  });

  it('moves the server clock while a race clock is held on air, not running', () => {
    // Arrange: the enduro clock on air but held at 0:00, and the wall clock 300 ms ahead.
    const { serverClock, store } = startReanchoringOnAStore();
    takeTheEnduroClockOnAir(store, { isRunning: false });
    stepTheWallClockBy(300);

    // Act: one check.
    letChecksHappen(1);

    // Assert: a held clock shows the same time whatever the server clock says, so the
    // check moved 50 ms.
    expect(
      serverClock.measureDriftFromWallClockMs(),
      'a held clock must not stop the re-anchoring',
    ).toBe(250);
  });

  it('moves nothing and logs nothing when there is no drift', () => {
    // Arrange: an empty air and a wall clock that never stepped.
    const { serverClock, readReanchorLogLines } = startReanchoringOnAStore();

    // Act: ten checks.
    letChecksHappen(10);

    // Assert: the server clock still reads the wall clock, and nothing was logged.
    expect(serverClock.readCurrentTimeMs(), 'with no drift nothing must move').toBe(Date.now());
    expect(readReanchorLogLines(), 'with no drift there is nothing to log').toEqual([]);
  });

  it('stops checking once stopped', () => {
    // Arrange: an empty air, the wall clock 300 ms ahead.
    const { serverClock, reanchoring } = startReanchoringOnAStore();
    stepTheWallClockBy(300);

    // Act: stop the re-anchoring (twice, as a close that runs twice would), then wait
    // what would have been three checks.
    reanchoring.stop();
    reanchoring.stop();
    letChecksHappen(3);

    // Assert: the drift is still all there.
    expect(
      serverClock.measureDriftFromWallClockMs(),
      'a stopped re-anchoring must move nothing',
    ).toBe(300);
  });
});
