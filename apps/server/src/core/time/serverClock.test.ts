/**
 * The server's one time source (apps/server)
 *
 * What this module is for:
 *   Everything the server stamps for clock math (a race clock's reference moment, the
 *   `serverNowMs` of each message, a take time, a replay's moved moment, an inbox
 *   event's `atMs`) reads the server clock. It counts on the machine's monotonic time,
 *   which never moves back, and is set to the wall clock once when it is created. Under
 *   load, the time sync of WSL2 and of Docker Desktop's Linux VM steps the wall clock by
 *   about a second every thirty; the server clock does not follow those steps.
 *
 * What these tests prove (with Vitest's fake Date and fake performance: a step of the
 *   wall clock moves Date.now() alone, while time passing moves both):
 *   - Created, it reads the wall clock's time, as a whole number of milliseconds.
 *   - It moves on with time, as the wall clock does.
 *   - A step of the wall clock back by 1 s, or forwards by 1 s, does not move it; the
 *     step shows as drift, which it reports.
 *   - Shifted by 50 ms (what the re-anchoring does), it reads 50 ms later from then on.
 *
 * What these tests deliberately do not cover:
 *   - When and by how much it is shifted; serverClockReanchoring.test.ts.
 *   - A race clock on air across a step; raceClockAcrossAWallClockStep.test.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createServerClock } from './serverClock.js';

/** 10 October 2026, 13:00 UTC: the endurance race is an hour in. */
const oneOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/**
 * Fakes the machine's wall clock and its monotonic time at one o'clock of the enduro,
 * and puts the real ones back when the test ends.
 */
function fakeTheMachineClocksAtOneOClock(): void {
  vi.useFakeTimers({ toFake: ['Date', 'performance'], now: oneOClockOfTheEnduroMs });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** Steps the wall clock alone by the given milliseconds, as a time sync does. */
function stepTheWallClockBy(milliseconds: number): void {
  vi.setSystemTime(Date.now() + milliseconds);
}

describe('the server clock', () => {
  it('reads the time of the wall clock when it is created', () => {
    // Arrange: the machine's clocks at one o'clock.
    fakeTheMachineClocksAtOneOClock();

    // Act: create the server clock and read it.
    const serverClock = createServerClock();
    const timeReadMs = serverClock.readCurrentTimeMs();

    // Assert: one o'clock, on the dot, as a Date too.
    expect(timeReadMs, 'the server clock must start at the wall clock').toBe(
      oneOClockOfTheEnduroMs,
    );
    expect(
      serverClock.readCurrentTime().toISOString(),
      'the Date it gives must name the same moment',
    ).toBe('2026-10-10T13:00:00.000Z');
  });

  it('moves on with time, as the wall clock does', () => {
    // Arrange: a server clock created at one o'clock.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();

    // Act: 90 seconds pass.
    vi.advanceTimersByTime(90_000);
    const timeReadMs = serverClock.readCurrentTimeMs();

    // Assert: 13:01:30, and no drift from the wall clock.
    expect(timeReadMs, 'ninety seconds must pass on the server clock too').toBe(
      oneOClockOfTheEnduroMs + 90_000,
    );
    expect(
      serverClock.measureDriftFromWallClockMs(),
      'with no step there is nothing between the two clocks',
    ).toBe(0);
  });

  const wallClockStepScenarios = [
    // What #52 saw under load: WSL2's time sync stepped the wall clock back about 1 s.
    { name: 'a step of the wall clock back by 1 s', stepMs: -1_000 },
    // The same sync can step it forwards; a race clock on air would skip a second.
    { name: 'a step of the wall clock forwards by 1 s', stepMs: 1_000 },
  ];

  for (const scenario of wallClockStepScenarios) {
    it(`does not follow ${scenario.name}, and reports it as drift`, () => {
      // Arrange: a server clock created at one o'clock, 30 seconds later.
      fakeTheMachineClocksAtOneOClock();
      const serverClock = createServerClock();
      vi.advanceTimersByTime(30_000);

      // Act: the wall clock steps, then a tenth of a second passes.
      stepTheWallClockBy(scenario.stepMs);
      vi.advanceTimersByTime(100);
      const timeReadMs = serverClock.readCurrentTimeMs();

      // Assert: 13:00:30.100 on the server clock, as if nothing had happened; the step
      // is the drift between the wall clock and it.
      expect(timeReadMs, 'the server clock must not follow a step of the wall clock').toBe(
        oneOClockOfTheEnduroMs + 30_100,
      );
      expect(
        serverClock.measureDriftFromWallClockMs(),
        'the drift is the wall clock minus the server clock: the step',
      ).toBe(scenario.stepMs);
    });
  }

  it('reads 50 ms later from the moment it is shifted by 50 ms', () => {
    // Arrange: a server clock 300 ms behind a wall clock that was stepped forwards.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    stepTheWallClockBy(300);

    // Act: shift it by 50 ms, as one re-anchoring does.
    serverClock.shiftServerTimeBy(50);

    // Assert: 13:00:00.050, and 250 ms of drift left.
    expect(serverClock.readCurrentTimeMs(), 'the shift must move the server clock by 50 ms').toBe(
      oneOClockOfTheEnduroMs + 50,
    );
    expect(
      serverClock.measureDriftFromWallClockMs(),
      'what the shift did not cover is still drift',
    ).toBe(250);
  });
});
