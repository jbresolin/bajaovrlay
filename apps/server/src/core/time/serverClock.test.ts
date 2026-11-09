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
 *   - Ramped to a rate of 1 / 1.04 over a minute, each second of the ramp a little shorter
 *     than the one before; after it, 104 s of monotonic time make 100 s; the change of
 *     rate itself moves nothing.
 *   - A slew of 1 s covers it at 0.5% of the time passing, in 200 s, and then stops; a
 *     new slew replaces the one in progress.
 *   - A step moves it at once and ends a slew in progress; steps are counted, slews not.
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

  it('ramps to a new rate over a minute, and changing the rate moves nothing at that moment', () => {
    // Arrange: a server clock 10 s old, on a machine whose monotonic time runs 4% fast.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    vi.advanceTimersByTime(10_000);
    const timeBeforeTheRateMs = serverClock.readCurrentTimeMs();

    // Act: ramp to the rate 1 / 1.04 over 60 s of monotonic time; let the minute of the
    // ramp pass, then 104 s more.
    serverClock.rampToRate(1 / 1.04, 60_000);
    const timeRightAfterTheRateMs = serverClock.readCurrentTimeMs();
    vi.advanceTimersByTime(60_000);
    const timeAtTheEndOfTheRampMs = serverClock.readCurrentTimeMs();
    vi.advanceTimersByTime(104_000);

    // Assert: no jump when the rate changed; over the ramp, the average of the two rates
    // (60 s × (1 + 1 / 1.04) / 2 = 58.846 s); then 100 s for 104 s of monotonic time.
    expect(timeRightAfterTheRateMs, 'a new rate must not move the clock at once').toBe(
      timeBeforeTheRateMs,
    );
    expect(
      timeAtTheEndOfTheRampMs - timeBeforeTheRateMs,
      'during the ramp the rate goes evenly from 1 to 1 / 1.04',
    ).toBe(58_846);
    expect(
      serverClock.readCurrentTimeMs() - timeAtTheEndOfTheRampMs,
      'after it, 104 s of a 4%-fast monotonic time are 100 s of real time',
    ).toBe(100_000);
    expect(serverClock.readRate(), 'the rate in use is the new one').toBeCloseTo(1 / 1.04, 12);
  });

  it('makes each second of the ramp a little shorter than the one before, never a jump', () => {
    // Arrange: a server clock on the same machine, ramping to 1 / 1.04 over a minute.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    serverClock.rampToRate(1 / 1.04, 60_000);

    // Act: read the clock (unrounded) after each second of monotonic time, for 70 s.
    const readings = [serverClock.readServerTimeAtMonotonicMs(serverClock.readMonotonicTimeMs())];
    for (let secondNumber = 1; secondNumber <= 70; secondNumber += 1) {
      vi.advanceTimersByTime(1_000);
      readings.push(serverClock.readServerTimeAtMonotonicMs(serverClock.readMonotonicTimeMs()));
    }

    // Assert: each second moved the clock by less than the one before, by at most 0.65 ms
    // (40 ms over 60 s), from 1000 ms down to 961.5 ms, where it stays. A thousandth of a
    // millisecond is allowed: moments since 1970 in floating point resolve to 0.00024 ms.
    const millisecondsEachSecond = readings
      .slice(1)
      .map((readingMs, secondNumber) => readingMs - (readings[secondNumber] ?? 0));
    const changesFromTheSecondBefore = millisecondsEachSecond
      .slice(1)
      .map((lengthMs, secondNumber) => lengthMs - (millisecondsEachSecond[secondNumber] ?? 0));
    expect(
      Math.min(...changesFromTheSecondBefore),
      'no second is more than 0.65 ms shorter than the one before',
    ).toBeGreaterThanOrEqual(-0.65);
    expect(
      Math.max(...changesFromTheSecondBefore),
      'and none is longer than the one before',
    ).toBeLessThanOrEqual(0.001);
    expect(millisecondsEachSecond.at(-1), 'the last seconds are of real time').toBeCloseTo(
      1_000 / 1.04,
      3,
    );
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

  it('counts its steps, so the pages know to line up again, and not its slews', () => {
    // Arrange: a new server clock, which has never stepped.
    fakeTheMachineClocksAtOneOClock();
    const serverClock = createServerClock();
    const stepsAtCreation = serverClock.readStepCount();

    // Act: a slew, then two steps.
    serverClock.slewBy(300);
    serverClock.stepBy(1_500);
    serverClock.stepBy(-2_000);

    // Assert: none at creation, two now.
    expect(stepsAtCreation, 'a new clock has made no step').toBe(0);
    expect(serverClock.readStepCount(), 'each step counts, a slew does not').toBe(2);
  });
});
