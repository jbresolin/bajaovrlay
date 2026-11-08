/**
 * The server's one time source (apps/server)
 *
 * What this module is for:
 *   Everything the server stamps for clock math (a race clock's reference moment, the
 *   `serverNowMs` of each message, a take time, a replay's moved moment, an inbox
 *   event's `atMs`) reads the server clock. It counts on the machine's monotonic time,
 *   which never moves back, set to the wall clock once when it is created, and from then
 *   on kept on real time by NTP (serverClockDiscipline.ts) in three ways: a rate, which
 *   corrects a machine whose monotonic time runs fast or slow; a slew, which covers a
 *   small difference at most 0.5% of the time passing; and a step, for a big one.
 *
 * What these tests prove (with Vitest's fake Date and fake performance: a step of the
 *   wall clock moves Date.now() alone, while time passing moves both):
 *   - Created, it reads the wall clock's time, as a whole number of milliseconds, and
 *     moves on with time.
 *   - A step of the wall clock back or forwards by 1 s does not move it.
 *   - Run at a rate of 1 / 1.04, 104 s of monotonic time make 100 s, and the change of
 *     rate itself moves nothing.
 *   - A slew of 1 s covers it at 0.5% of the time passing, in 200 s, and then stops; a
 *     new slew replaces the one in progress.
 *   - A step moves it at once and ends a slew in progress.
 *
 * What these tests deliberately do not cover:
 *   - When it is stepped, slewed or given a rate; serverClockDiscipline.test.ts.
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
  it('reads the time of the wall clock when it is created, and moves on with time', () => {
    // Arrange: the machine's clocks at one o'clock, and a server clock created then.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    const timeAtCreationMs = serverClock.readCurrentTimeMs();

    // Act: 90 seconds pass.
    vi.advanceTimersByTime(90_000);
    const timeAfterwardsMs = serverClock.readCurrentTimeMs();

    // Assert: one o'clock on the dot, then 13:01:30, also as a Date.
    expect(timeAtCreationMs, 'the server clock must start at the wall clock').toBe(
      oneOClockOfTheEnduroMs,
    );
    expect(timeAfterwardsMs, 'ninety seconds must pass on the server clock too').toBe(
      oneOClockOfTheEnduroMs + 90_000,
    );
    expect(
      serverClock.readCurrentTime().toISOString(),
      'the Date it gives must name the same moment',
    ).toBe('2026-10-10T13:01:30.000Z');
  });

  const wallClockStepScenarios = [
    // What #52 saw under load: WSL2's time sync stepped the wall clock back about 1 s.
    { name: 'a step of the wall clock back by 1 s', stepMs: -1_000 },
    // The same sync can step it forwards; a race clock on air would skip a second.
    { name: 'a step of the wall clock forwards by 1 s', stepMs: 1_000 },
  ];

  it.each(wallClockStepScenarios)('does not follow $name', ({ stepMs }) => {
    // Arrange: a server clock created at one o'clock, 30 seconds later.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    vi.advanceTimersByTime(30_000);

    // Act: the wall clock steps, then a tenth of a second passes.
    stepTheWallClockBy(stepMs);
    vi.advanceTimersByTime(100);

    // Assert: 13:00:30.100 on the server clock, as if nothing had happened.
    expect(
      serverClock.readCurrentTimeMs(),
      'the server clock must not follow a step of the wall clock',
    ).toBe(oneOClockOfTheEnduroMs + 30_100);
  });

  it('runs at the rate it is given, and changing the rate moves nothing at that moment', () => {
    // Arrange: a server clock 10 s old, on a machine whose monotonic time runs 4% fast.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    vi.advanceTimersByTime(10_000);
    const timeBeforeTheRateMs = serverClock.readCurrentTimeMs();

    // Act: give it the rate 1 / 1.04, then let 104 s of monotonic time pass.
    serverClock.runAtRate(1 / 1.04);
    const timeRightAfterTheRateMs = serverClock.readCurrentTimeMs();
    vi.advanceTimersByTime(104_000);

    // Assert: no jump when the rate changed, and 100 s for 104 s of monotonic time.
    expect(timeRightAfterTheRateMs, 'a new rate must not move the clock at once').toBe(
      timeBeforeTheRateMs,
    );
    expect(
      serverClock.readCurrentTimeMs() - timeBeforeTheRateMs,
      '104 s of a 4%-fast monotonic time are 100 s of real time',
    ).toBe(100_000);
  });

  it('covers a slew of 1 s at 0.5% of the time passing, then stops', () => {
    // Arrange: a server clock at one o'clock that is 1 s behind real time.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();

    // Act: slew by 1 s, then read after 100 s, 200 s and 300 s.
    serverClock.slewBy(1_000);
    vi.advanceTimersByTime(100_000);
    const timeAfter100SecondsMs = serverClock.readCurrentTimeMs();
    const slewLeftAfter100SecondsMs = serverClock.readSlewLeftMs();
    vi.advanceTimersByTime(100_000);
    const timeAfter200SecondsMs = serverClock.readCurrentTimeMs();
    vi.advanceTimersByTime(100_000);
    const timeAfter300SecondsMs = serverClock.readCurrentTimeMs();

    // Assert: half a second covered in 100 s (100.5 s passed on the server clock), the
    // whole second in 200 s, and from then on 100 s for 100 s again.
    expect(timeAfter100SecondsMs - oneOClockOfTheEnduroMs, '0.5% faster: 100.5 s').toBe(100_500);
    expect(slewLeftAfter100SecondsMs, 'half of the slew is still to come').toBe(500);
    expect(timeAfter200SecondsMs - oneOClockOfTheEnduroMs, 'the whole second covered').toBe(
      201_000,
    );
    expect(timeAfter300SecondsMs - timeAfter200SecondsMs, 'once covered, the slew stops').toBe(
      100_000,
    );
  });

  it('replaces a slew in progress with a new one', () => {
    // Arrange: a slew of 1 s, half covered after 100 s.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    serverClock.slewBy(1_000);
    vi.advanceTimersByTime(100_000);

    // Act: a new answer says the clock is now 200 ms ahead: slew by −200 ms.
    serverClock.slewBy(-200);
    vi.advanceTimersByTime(100_000);

    // Assert: the old half second is forgotten; 200 ms were taken back in 40 s, then
    // the clock ran at its rate (100.5 s, then 100 s − 0.2 s).
    expect(serverClock.readCurrentTimeMs() - oneOClockOfTheEnduroMs, 'the new slew only').toBe(
      200_300,
    );
    expect(serverClock.readSlewLeftMs(), 'nothing left to slew').toBe(0);
  });

  it('moves at once when it is stepped, and the step ends a slew in progress', () => {
    // Arrange: a slew of 2 s in progress.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    serverClock.slewBy(2_000);

    // Act: step forwards by 8 hours, as after a night's sleep, then let 10 s pass.
    serverClock.stepBy(8 * 60 * 60 * 1000);
    vi.advanceTimersByTime(10_000);

    // Assert: eight hours and ten seconds later, with nothing left to slew.
    expect(
      serverClock.readCurrentTime().toISOString(),
      'a step moves the clock at once, by the whole difference',
    ).toBe('2026-10-10T21:00:10.000Z');
    expect(serverClock.readSlewLeftMs(), 'a step replaces the slew').toBe(0);
  });
});
