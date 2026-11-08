/**
 * The server clock kept on real time by NTP (apps/server)
 *
 * What this module is for:
 *   Neither the browser nor the VM keeps good time, and race times will come stamped by
 *   another computer, so the server keeps real time from NTP and the pages line up with
 *   the server (BAJAOVRLAY-62). The discipline polls NTP every 64 s and corrects the
 *   server clock in two separate parts:
 *   - the rate, from the answers of the last eight minutes, up to ±10%: a machine whose
 *     monotonic time runs 4% fast still counts seconds of real time;
 *   - the offset: under 1 s it is slewed at 0.5% at most; 1 s or more, confirmed by a
 *     second poll at once, it is stepped, unless something on program or preview counts
 *     time, in which case it keeps slewing and the header warns from 2 s on.
 *   At boot it steps to real time before the server accepts connections, waiting up to
 *   3 s; without an answer the server starts on the machine's wall clock and says so.
 *   "Acertar relógio agora" steps at once, whatever is on air.
 *
 * What these tests prove (on fake time: the machine's monotonic time at a chosen speed,
 *   real time from a fake NTP that answers at once, the wall clock stepped as timesyncd
 *   does, sleep moving real time alone):
 *   - The boot steps to real time; with no answer in 3 s the server starts on the wall
 *     clock and warns.
 *   - A machine 4% fast whose wall clock is stepped back 1 s every 32 s: within a few
 *     minutes the server clock is within 50 ms of real time, and stays there; once the
 *     rate has settled, every second of real time moves the clock on air by 995 to
 *     1005 ms, so no second on air is shorter than 0.995 s or longer than 1.005 s; and the
 *     wall clock's steps never show.
 *   - The same machine with a clock running on air from the start: never stepped, every
 *     second within 0.995–1.005 s once the rate has settled, within 50 ms in 12 minutes.
 *   - Eight hours of sleep: stepped at the next poll with nothing counting time; with a
 *     clock running, slewed, with the difference reported for the header's warning.
 *   - NTP unreachable for half an hour: the clock runs on at its last rate, still within
 *     50 ms of real time, and the outage is warned once.
 *   - "Acertar relógio agora" steps at once while a clock runs.
 *
 * What these tests deliberately do not cover:
 *   - The UDP questions themselves; ntpClient.test.ts and ntpPolls.test.ts.
 *   - The rate's arithmetic and its outliers; realTimeRate.test.ts.
 *   - What counts time on air; timeCountedOnAnOutput.test.ts.
 *   - The boot of the whole server; core/boot.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  measureServerMillisecondsPerRealSecond,
  startAServerClockInAFakeWorld,
  tenOClockOfTheEnduroMs,
  watchTheClocksFor,
} from './fakeWorldOfTime.testSupport.js';

const oneMinuteMs = 60_000;
const eightHoursMs = 8 * 60 * oneMinuteMs;

/**
 * The least and the most the clock on air may move in one second of real time: a slew at
 * the full 0.5% lands exactly on 995 or 1005, so a hundredth of a millisecond is allowed
 * for the arithmetic of floating point.
 */
const fewestServerMillisecondsPerRealSecond = 995 - 0.01;
const mostServerMillisecondsPerRealSecond = 1_005 + 0.01;

/** How far apart the two clocks are at one look, in ms. */
function measureHowFarFromRealTime(look: { realTimeMs: number; serverTimeMs: number }): number {
  return Math.abs(look.serverTimeMs - look.realTimeMs);
}

describe('the server clock at boot', () => {
  it('steps to real time before anything else reads it', async () => {
    // Arrange: a machine whose wall clock is 5 s behind real time when the server boots.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: -5_000,
    });
    const timeBeforeTheStepMs = world.serverClock.readCurrentTimeMs();

    // Act: the boot asks NTP.
    await world.discipline.stepToRealTimeAtBoot();

    // Assert: it started on the wall clock, 5 s behind, and now reads real time.
    expect(timeBeforeTheStepMs, 'before NTP, the server clock is the wall clock').toBe(
      tenOClockOfTheEnduroMs - 5_000,
    );
    expect(
      world.serverClock.readCurrentTimeMs(),
      'after the boot step, the server clock reads real time',
    ).toBe(tenOClockOfTheEnduroMs);
  });

  it('starts on the wall clock after 3 s with no answer, and warns', async () => {
    // Arrange: the same machine with no network at boot: the poll never ends.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: -5_000,
    });
    world.makeNtpNeverAnswer();
    let isTheBootDone = false;

    // Act: the boot asks NTP, then 2.9 s pass, then 0.1 s more.
    const bootStep = world.discipline.stepToRealTimeAtBoot().then(() => {
      isTheBootDone = true;
    });
    await vi.advanceTimersByTimeAsync(2_900);
    const isTheBootDoneAt2900Ms = isTheBootDone;
    await vi.advanceTimersByTimeAsync(100);
    await bootStep;

    // Assert: the boot waited 3 s, no longer; the clock is the wall clock; a warning says so.
    expect(isTheBootDoneAt2900Ms, 'the boot waits up to 3 s for NTP').toBe(false);
    expect(isTheBootDone, 'and not a moment longer').toBe(true);
    expect(
      world.serverClock.readCurrentTimeMs(),
      'without an answer the server clock stays on the wall clock',
    ).toBe(tenOClockOfTheEnduroMs - 5_000 + 3_000);
    expect(
      world
        .readRecordedLines()
        .some((line) => line.level === 'warn' && line.message.includes("machine's wall clock")),
      'the log must say the server started without real time',
    ).toBe(true);
  });
});

describe('a machine whose monotonic time runs 4% fast', () => {
  it('tracks real time within 50 ms in a few minutes, with no second on air off by more than 0.5%', async () => {
    // Arrange: João's WSL under load: monotonic time 4% fast, and timesyncd stepping the
    // wall clock back 1 s every 32 s. Nothing on air counts time. The boot steps to NTP.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0.04,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();

    // Act: watch both clocks for 20 minutes, a look every second.
    const looks = await watchTheClocksFor(world, 20 * oneMinuteMs, {
      wallClockStepEveryMs: 32_000,
    });

    // Assert: from minute 3 on, within 50 ms at every look, and every second of real time
    // moved the clock on air by 995 to 1005 ms; the rate is 1 / 1.04.
    const looksFromMinute3 = looks.slice(3 * 60);
    const farthestFromRealTimeMs = Math.max(...looksFromMinute3.map(measureHowFarFromRealTime));
    expect(farthestFromRealTimeMs, 'within a few minutes the server clock tracks NTP').toBeLessThan(
      50,
    );
    const millisecondsPerRealSecond = measureServerMillisecondsPerRealSecond(looksFromMinute3);
    expect(
      Math.min(...millisecondsPerRealSecond),
      'no second on air may last longer than 1.005 s once the rate has settled',
    ).toBeGreaterThanOrEqual(fewestServerMillisecondsPerRealSecond);
    expect(
      Math.max(...millisecondsPerRealSecond),
      'no second on air may last less than 0.995 s once the rate has settled',
    ).toBeLessThanOrEqual(mostServerMillisecondsPerRealSecond);
    expect(world.serverClock.readRate(), 'the rate corrects the 4%').toBeCloseTo(1 / 1.04, 6);
  });

  it('never steps while a clock runs on air, and still reaches real time by slewing', async () => {
    // Arrange: the same machine, with the enduro clock running on air from the boot.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0.04,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    world.setSomethingCountingTimeOnAir(true);
    await world.discipline.stepToRealTimeAtBoot();

    // Act: watch both clocks for 15 minutes.
    const looks = await watchTheClocksFor(world, 15 * oneMinuteMs, {
      wallClockStepEveryMs: 32_000,
    });

    // Assert: after the first poll (64 s) has given a rate, every second of real time
    // moved the clock on air by 995 to 1005 ms, so it never jumped; by minute 12 it is
    // within 50 ms of real time.
    const looksAfterTheFirstPoll = looks.slice(65);
    const millisecondsPerRealSecond =
      measureServerMillisecondsPerRealSecond(looksAfterTheFirstPoll);
    expect(
      Math.min(...millisecondsPerRealSecond),
      'a clock running on air must never see the server clock stepped back',
    ).toBeGreaterThanOrEqual(fewestServerMillisecondsPerRealSecond);
    expect(Math.max(...millisecondsPerRealSecond), 'nor stepped forwards').toBeLessThanOrEqual(
      mostServerMillisecondsPerRealSecond,
    );
    const looksFromMinute12 = looks.slice(12 * 60);
    expect(
      Math.max(...looksFromMinute12.map(measureHowFarFromRealTime)),
      'the slew reaches real time all the same',
    ).toBeLessThan(50);
  });
});

describe('a machine that slept eight hours', () => {
  it('steps to real time at the next poll when nothing on air counts time', async () => {
    // Arrange: an accurate machine, booted on NTP, that sleeps 8 h 30 s after the boot.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(30_000);
    world.sleepFor(eightHoursMs);

    // Act: watch both clocks for a minute and a half, past the next poll (at 64 s).
    const looks = await watchTheClocksFor(world, 90_000);

    // Assert: eight hours behind before the poll, on real time after it.
    const lookBeforeThePoll = looks[20];
    const lastLook = looks[looks.length - 1];
    if (lookBeforeThePoll === undefined || lastLook === undefined) {
      throw new Error('Ninety looks were taken.');
    }
    expect(
      measureHowFarFromRealTime(lookBeforeThePoll),
      'monotonic time did not count the sleep',
    ).toBeGreaterThan(eightHoursMs - 1_000);
    expect(
      measureHowFarFromRealTime(lastLook),
      'the next poll stepped the eight hours',
    ).toBeLessThan(50);
    expect(
      world.discipline.readStatus().offFromRealTimeMs,
      'nothing is left for the header to warn about',
    ).toBe(0);
  });

  it('slews instead, with the difference reported for the header, while a clock runs', async () => {
    // Arrange: the same, with the enduro clock running on air.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    world.setSomethingCountingTimeOnAir(true);
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(30_000);
    world.sleepFor(eightHoursMs);

    // Act: watch both clocks for three minutes, past two polls.
    const looks = await watchTheClocksFor(world, 3 * oneMinuteMs);

    // Assert: no second on air off by more than 0.5% (so no jump), and the header's
    // number says the server clock is still about eight hours behind real time.
    const millisecondsPerRealSecond = measureServerMillisecondsPerRealSecond(looks);
    expect(
      Math.max(...millisecondsPerRealSecond),
      'a clock on air must not jump eight hours',
    ).toBeLessThanOrEqual(mostServerMillisecondsPerRealSecond);
    expect(
      world.discipline.readStatus().offFromRealTimeMs,
      'the difference left is reported, positive since the server clock is behind',
    ).toBeGreaterThan(eightHoursMs - 2 * oneMinuteMs);
  });

  it('steps at once on "Acertar relógio agora", although a clock runs', async () => {
    // Arrange: the clock on air held the eight hours, as in the test above.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    world.setSomethingCountingTimeOnAir(true);
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(30_000);
    world.sleepFor(eightHoursMs);
    await vi.advanceTimersByTimeAsync(oneMinuteMs);

    // Act: the producer presses "Acertar relógio agora".
    const outcome = await world.discipline.setToRealTimeNow('operador:produtor');

    // Assert: stepped by about eight hours, and on real time.
    expect(outcome.isSet, 'NTP answered, so the clock was set').toBe(true);
    expect(
      outcome.isSet && outcome.steppedByMs,
      'the step is what was left of the eight hours',
    ).toBeGreaterThan(eightHoursMs - oneMinuteMs);
    expect(
      Math.abs(world.serverClock.readCurrentTimeMs() - world.readRealTimeMs()),
      'the server clock reads real time',
    ).toBeLessThan(2);
  });
});

describe('NTP out of reach', () => {
  it('keeps the clock running at its last rate, and warns once', async () => {
    // Arrange: the 4%-fast machine, settled after five minutes on NTP; then the uplink at
    // the track goes down.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0.04,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(5 * oneMinuteMs);
    world.setNtpReachable(false);

    // Act: half an hour passes without an answer.
    const looks = await watchTheClocksFor(world, 30 * oneMinuteMs);

    // Assert: still within 50 ms of real time; one warning about the outage, however many
    // polls went unanswered; the last answer is still the one reported.
    expect(
      Math.max(...looks.map(measureHowFarFromRealTime)),
      'the last rate keeps the clock on real time without NTP',
    ).toBeLessThan(50);
    const outageWarnings = world
      .readRecordedLines()
      .filter((line) => line.level === 'warn' && line.message.includes('NTP gave no answer'));
    expect(outageWarnings, 'one warning when NTP stops answering, not one per poll').toHaveLength(
      1,
    );
    expect(
      world.discipline.readStatus().lastNtpAnswer?.serverName,
      '"Verificar servidor" still shows the last answer',
    ).toBe('a.st1.ntp.br:123');
  });
});
