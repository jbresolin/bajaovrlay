/**
 * The race clock bound whole follows a red flag without a jump (apps/server)
 *
 * What this module is for:
 *   "Relógio da fonte" binds the race clock's four clock fields (time, moment, running,
 *   mode) to the source's whole session clock at once, so every refresh puts one reading
 *   on air and the clock never shows a new time with an old moment. This is the M2
 *   promise: a race clock bound to the simulator follows the race on air, and stops on
 *   a red flag where the source stopped it.
 *
 * What these tests prove:
 *   - Under green, a later poll moves the reading on, and the time the screen shows at
 *     that moment is the same before and after the refresh (no jump).
 *   - At the red flag the flag turns red and the clock stops, again with no jump at the
 *     moment of the refresh, and still shows the same time ten seconds later.
 *
 * What these tests deliberately do not cover:
 *   - How the graphic draws the time; the race clock's own tests.
 */
import {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  type Instance,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  applyOrThrow,
  buildEnduroSession,
  buildSessionBinding,
  createClockItem,
  momentOfTheCommandsMs,
  openStoreWithTheRefresher,
  pollTheSimulatorWithSession,
  readInstanceOn,
} from './liveRefresh.testSupport.js';

/** The clock reading an instance shows. */
function readClockReading(instance: Instance | undefined): ClockReading {
  const data = instance?.resolvedData ?? {};
  return {
    clockMode: data.clockMode as ClockReading['clockMode'],
    referenceTimeMs: data.referenceTimeMs as number,
    referenceWallClockMs: data.referenceWallClockMs as number,
    running: data.running as boolean,
  };
}

/** The simulator's session clock at a moment: counting down from 1:16:00 at 14:00:00. */
function buildRunningClockAt(momentMs: number) {
  return {
    clockMode: 'remaining' as const,
    referenceTimeMs: 4_560_000 - (momentMs - momentOfTheCommandsMs),
    referenceWallClockMs: momentMs,
    running: true,
  };
}

describe('the race clock bound to the whole session clock', () => {
  it('follows the source and stops on the red flag without a jump', () => {
    // Arrange: the simulator under green; the race clock with its flag and its whole
    // clock bound live ("Relógio da fonte"), taken at 14:00:00.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio do enduro — fonte', 'clock', {
      state: buildSessionBinding('state'),
      referenceTimeMs: buildSessionBinding('clock'),
      referenceWallClockMs: { kind: 'literal', value: null },
      running: { kind: 'literal', value: null },
      clockMode: { kind: 'literal', value: null },
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });

    // Act: a poll at 14:00:02 still under green, then the red flag at 14:00:04 with
    // the clock stopped where it stood.
    const greenPollMs = momentOfTheCommandsMs + 2_000;
    const readingBeforeGreenPoll = readClockReading(readInstanceOn(stateStore, 'clock', 'program'));
    pollTheSimulatorWithSession(
      stateStore,
      buildEnduroSession({ clock: buildRunningClockAt(greenPollMs), updatedAtMs: greenPollMs }),
    );
    refreshTimer.runThePendingRefresh();
    const readingAfterGreenPoll = readClockReading(readInstanceOn(stateStore, 'clock', 'program'));
    const redFlagMs = momentOfTheCommandsMs + 4_000;
    const stoppedClock = { ...buildRunningClockAt(redFlagMs), running: false };
    pollTheSimulatorWithSession(
      stateStore,
      buildEnduroSession({ state: 'red', clock: stoppedClock, updatedAtMs: redFlagMs }),
    );
    refreshTimer.runThePendingRefresh();
    const clockAfterRedFlag = readInstanceOn(stateStore, 'clock', 'program');
    const readingAfterRedFlag = readClockReading(clockAfterRedFlag);

    // Assert: each refresh shows, at its own moment, the time the screen already showed;
    // after the red flag the clock is red and stopped, and stays put ten seconds on.
    expect(
      computeClockTimeMsAtWallClock(readingAfterGreenPoll, greenPollMs),
      'no jump at the green poll',
    ).toBe(computeClockTimeMsAtWallClock(readingBeforeGreenPoll, greenPollMs));
    expect(
      computeClockTimeMsAtWallClock(readingAfterRedFlag, redFlagMs),
      'no jump at the red flag',
    ).toBe(computeClockTimeMsAtWallClock(readingAfterGreenPoll, redFlagMs));
    expect(clockAfterRedFlag?.resolvedData.state, 'the flag must turn red').toBe('red');
    expect(readingAfterRedFlag.running, 'the clock must stop').toBe(false);
    expect(
      computeClockTimeMsAtWallClock(readingAfterRedFlag, redFlagMs + 10_000),
      'a stopped clock shows the same time ten seconds later',
    ).toBe(4_556_000);
  });
});
