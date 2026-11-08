/**
 * A race clock on air while the machine's wall clock steps (apps/server, with the
 * page's side from @bajaovrlay/shared/clock)
 *
 * What this module is for:
 *   Under load, WSL2's time sync stepped the machine's wall clock back by about a second
 *   every thirty (#52), and the stream PC runs the server in Docker Desktop, whose Linux
 *   VM syncs its clock the same way. When the server stamped clock moments with
 *   Date.now(), a running race clock on air repeated a second (12:38 → 12:37 → 12:38)
 *   after a step back and skipped one after a step forwards. The server now stamps with
 *   its server clock (monotonic time), and the page counts between samples on its own
 *   monotonic time, so neither side follows a step.
 *
 * What these tests prove (a real store and the built race clock; the page's side is
 *   the very code the renderer and the race clock graphic run; Vitest's fake Date moves
 *   alone for a step, while fake performance and Date move together as time passes; the
 *   server and the page share one machine, as on the stream PC):
 *   - The enduro clock taken at 0:00, read ten times a second for a minute with a
 *     `time` sample every ten seconds, as the graphic does: the wall clock stepped back
 *     1 s at 0:30 (and, in a second row, forwards 1 s), the seconds shown never go back
 *     and never skip one, and a minute in the clock shows 1:00.
 *   - Stopped by the operator after the step, the clock holds the second that was on
 *     screen at the press.
 *
 * What these tests deliberately do not cover:
 *   - The server clock alone; serverClock.test.ts. Its slow return to the wall clock;
 *     serverClockReanchoring.test.ts.
 *   - Real sockets and a real browser: the renderer's e2e tests show the race clock on
 *     air, and its serverConnection.serverClock.test.ts the samples taken from messages.
 */
import {
  computeClockTimeMsAtWallClock,
  countWholeSecondsClockShows,
  forgetServerClockSamples,
  readServerAlignedTimeMs,
  readThisMachineMonotonicTimeMs,
  recordServerClockSample,
} from '@bajaovrlay/shared/clock';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { ServerClock } from './serverClock.js';
import {
  createStoreOnAServerClock,
  fakeTheMachineClocksAtTenOClock,
  stepTheWallClockBy,
  stopTheClockOnAir,
  takeTheEnduroClockOnAir,
} from './serverClockOnTheStore.testSupport.js';

/** How often the server sends a `time` message (serverTimeBroadcast.ts). */
const timeMessageIntervalMs = 10_000;

/** How often the test reads the clock as the graphic would: ten times a second. */
const frameIntervalMs = 100;

/** The page's side of the clock: samples recorded, and what the race clock shows. */
type PageThatShowsTheClock = {
  /** Records the server clock's time as a `time` message would carry it, on arrival. */
  receiveATimeMessage: () => void;
  /** The whole seconds the race clock on air shows now, as its graphic works them out. */
  readSecondsOnScreen: () => number;
};

/**
 * Builds the page's side for the clock on air in `store`: samples taken from the server
 * clock, and the graphic's sum over the instance's data. Forgets the samples when the
 * test ends, since they live on the one `globalThis` the tests share.
 */
function openThePageThatShowsTheClock(
  serverClock: ServerClock,
  store: ReturnType<typeof createStoreOnAServerClock>['store'],
): PageThatShowsTheClock {
  forgetServerClockSamples();
  onTestFinished(() => {
    forgetServerClockSamples();
  });
  return {
    receiveATimeMessage: () => {
      recordServerClockSample(serverClock.readCurrentTimeMs(), readThisMachineMonotonicTimeMs());
    },
    readSecondsOnScreen: () => {
      const dataOnAir = store.readAllSlices().instances[0]?.resolvedData;
      if (dataOnAir === undefined) {
        throw new Error('There is no clock on air to read.');
      }
      const reading = {
        clockMode: dataOnAir.clockMode as 'elapsed' | 'remaining',
        referenceTimeMs: dataOnAir.referenceTimeMs as number,
        referenceWallClockMs: dataOnAir.referenceWallClockMs as number,
        running: dataOnAir.running as boolean,
      };
      const clockTimeMs = computeClockTimeMsAtWallClock(reading, readServerAlignedTimeMs());
      return countWholeSecondsClockShows(clockTimeMs, reading.clockMode);
    },
  };
}

/**
 * Runs the given number of milliseconds frame by frame: a `time` message every ten
 * seconds, the seconds on screen read at every frame, and the wall clock stepped once
 * when `stepAtMs` is reached. Returns the seconds read, frame by frame.
 */
function watchTheClockFrameByFrame(
  page: PageThatShowsTheClock,
  options: { durationMs: number; stepAtMs: number; stepMs: number },
): number[] {
  const secondsReadAtEachFrame: number[] = [page.readSecondsOnScreen()];
  for (
    let passedMs = frameIntervalMs;
    passedMs <= options.durationMs;
    passedMs += frameIntervalMs
  ) {
    vi.advanceTimersByTime(frameIntervalMs);
    if (passedMs === options.stepAtMs) {
      stepTheWallClockBy(options.stepMs);
    }
    if (passedMs % timeMessageIntervalMs === 0) {
      page.receiveATimeMessage();
    }
    secondsReadAtEachFrame.push(page.readSecondsOnScreen());
  }
  return secondsReadAtEachFrame;
}

/** Lists, frame to frame, how far the seconds on screen moved (0 or 1 when all is well). */
function listMovesBetweenFrames(secondsReadAtEachFrame: number[]): number[] {
  const moves: number[] = [];
  for (let frame = 1; frame < secondsReadAtEachFrame.length; frame += 1) {
    const secondsNow = secondsReadAtEachFrame[frame] ?? 0;
    const secondsBefore = secondsReadAtEachFrame[frame - 1] ?? 0;
    moves.push(secondsNow - secondsBefore);
  }
  return moves;
}

const wallClockStepScenarios = [
  // What #52 saw: a step back would make the clock repeat a second (0:30 → 0:29 → 0:30).
  { name: 'stepped back 1 s', stepMs: -1_000 },
  // A step forwards would make it skip one (0:29 → 0:31).
  { name: 'stepped forwards 1 s', stepMs: 1_000 },
];

describe('a race clock on air while the wall clock steps', () => {
  for (const scenario of wallClockStepScenarios) {
    it(`never goes back or skips a second with the wall clock ${scenario.name}`, () => {
      // Arrange: the enduro clock taken running from 0:00 at ten o'clock, and a page
      // that has had the hello's sample.
      fakeTheMachineClocksAtTenOClock();
      const { serverClock, store } = createStoreOnAServerClock();
      takeTheEnduroClockOnAir(store, { isRunning: true });
      const page = openThePageThatShowsTheClock(serverClock, store);
      page.receiveATimeMessage();

      // Act: watch it for a minute, ten frames a second, with the step at 0:30.
      const secondsReadAtEachFrame = watchTheClockFrameByFrame(page, {
        durationMs: 60_000,
        stepAtMs: 30_000,
        stepMs: scenario.stepMs,
      });

      // Assert: from frame to frame the seconds moved by 0 or 1, never back and never
      // by 2; a minute in it shows 1:00.
      const movesThatAreNotZeroOrOne = listMovesBetweenFrames(secondsReadAtEachFrame).filter(
        (move) => move !== 0 && move !== 1,
      );
      expect(
        movesThatAreNotZeroOrOne,
        'the clock on air must never go back a second nor skip one',
      ).toEqual([]);
      expect(secondsReadAtEachFrame.at(-1), 'a minute after the take it must show 1:00').toBe(60);
    });
  }

  it('holds the second that was on screen when the operator stops it after a step', () => {
    // Arrange: the enduro clock running, watched for 45 s with the wall clock stepped
    // back 1 s at 0:30; the time on screen read just before the press.
    fakeTheMachineClocksAtTenOClock();
    const { serverClock, store } = createStoreOnAServerClock();
    takeTheEnduroClockOnAir(store, { isRunning: true });
    const page = openThePageThatShowsTheClock(serverClock, store);
    page.receiveATimeMessage();
    watchTheClockFrameByFrame(page, { durationMs: 45_000, stepAtMs: 30_000, stepMs: -1_000 });
    const secondsOnScreenAtThePress = page.readSecondsOnScreen();

    // Act: the operator presses "Parar".
    stopTheClockOnAir(store);

    // Assert: 0:45 on screen at the press, and 0:45 held after it.
    expect(secondsOnScreenAtThePress, 'forty-five seconds must have passed on screen').toBe(45);
    expect(page.readSecondsOnScreen(), 'the stopped clock must hold the second it showed').toBe(45);
  });
});
