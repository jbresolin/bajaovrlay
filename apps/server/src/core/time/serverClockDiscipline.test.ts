/**
 * The server clock kept on real time by NTP (apps/server)
 *
 * What this module is for:
 *   Neither the browser nor the VM keeps good time, and race times will come stamped by
 *   another computer, so the server keeps real time from NTP and the pages line up with
 *   the server (BAJAOVRLAY-62). The discipline polls NTP and corrects the server clock in
 *   two separate parts:
 *   - the rate, from the answers of the last eight minutes, up to ±10%, ramped to over a
 *     minute: a machine whose monotonic time runs 4% fast still counts seconds of real
 *     time, and the length of a second on air never changes at once;
 *   - the offset: under 1 s it is slewed at 0.5% at most; 1 s or more, confirmed by a
 *     second poll, it is stepped, unless something on program or preview counts time, in
 *     which case it keeps slewing and the header warns from 2 s on.
 *   At boot it steps to real time before the server accepts connections, waiting up to
 *   3 s; without an answer the server starts on the machine's wall clock and says so.
 *   "Acertar relógio agora" steps at once, whatever is on air. Every step is told to the
 *   pages, which line up again at once.
 *
 * What these tests prove (on fake time: the machine's monotonic time at a chosen speed,
 *   real time from a fake NTP that answers at once, through a network that adds jitter
 *   of about ±15 ms and now and then a 238 ms delay; the wall clock stepped as timesyncd
 *   does; sleep moving real time alone):
 *   - The boot steps to real time and tells the pages; with no answer in 3 s the server
 *     starts on the wall clock and warns.
 *   - A machine 4% fast whose wall clock is stepped back 1 s every 32 s: from minute 3 the
 *     server clock is within 50 ms of real time at every look, and every second of real
 *     time moves the clock on air by 995 to 1005 ms; the wall clock's steps never show.
 *   - The same machine with a clock running on air from the start: never stepped; from the
 *     very first second, no second on air is more than 11 ms longer or shorter than the
 *     one before (the 4% comes off over a minute, not at once); from minute 3 every second
 *     lasts 0.995–1.005 s; within 50 ms in 12 minutes.
 *   - Eight hours of sleep: stepped once confirmed, with nothing counting time; with a
 *     clock running, slewed, the difference reported for the header, warned once only.
 *   - A pause of 3 s: stepped once confirmed, and not taken for a rate.
 *   - NTP unreachable for half an hour: the clock runs on at its last rate, still within
 *     50 ms of real time, and the outage is warned once.
 *   - "Acertar relógio agora" steps at once while a clock runs, and tells the pages.
 *
 * What these tests deliberately do not cover:
 *   - When polls are made, what they ask, and NTP's time refused past 24 h;
 *     serverClockDisciplinePolls.test.ts.
 *   - The UDP questions themselves; ntpClient.test.ts and ntpPolls.test.ts.
 *   - The rate's arithmetic and its outliers; realTimeRate.test.ts.
 *   - What counts time on air; timeCountedOnAnOutput.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  answersOverTheInternetFromTheTrack,
  measureChangeFromTheSecondBefore,
  measureServerMillisecondsPerRealSecond,
  startAServerClockInAFakeWorld,
  tenOClockOfTheEnduroMs,
  watchTheClocksFor,
} from './fakeWorldOfTime.testSupport.js';

const oneMinuteMs = 60_000;
const eightHoursMs = 8 * 60 * oneMinuteMs;

/**
 * The least and the most the clock on air may move in one second of real time: a slew at
 * the full 0.5% lands exactly on 995 or 1005, and the rate measured through ±15 ms of
 * jitter is off by a few thousandths of a percent, so a tenth of a millisecond is allowed.
 */
const fewestServerMillisecondsPerRealSecond = 995 - 0.1;
const mostServerMillisecondsPerRealSecond = 1_005 + 0.1;

/** How far apart the two clocks are at one look, in ms. */
function measureHowFarFromRealTime(look: { realTimeMs: number; serverTimeMs: number }): number {
  return Math.abs(look.serverTimeMs - look.realTimeMs);
}

describe('the server clock at boot', () => {
  it('steps to real time before anything else reads it, and tells the pages', async () => {
    // Arrange: a machine whose wall clock is 5 s behind real time when the server boots.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: -5_000,
    });
    const timeBeforeTheStepMs = world.serverClock.readCurrentTimeMs();

    // Act: the boot asks NTP.
    await world.discipline.stepToRealTimeAtBoot();

    // Assert: it started on the wall clock, 5 s behind, and now reads real time; one step
    // was told, for a page that is already connected (none is, at boot).
    expect(timeBeforeTheStepMs, 'before NTP, the server clock is the wall clock').toBe(
      tenOClockOfTheEnduroMs - 5_000,
    );
    expect(
      world.serverClock.readCurrentTimeMs(),
      'after the boot step, the server clock reads real time',
    ).toBe(tenOClockOfTheEnduroMs);
    expect(world.countStepsToldToThePages(), 'the step is told').toBe(1);
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
  it('tracks real time within 50 ms from minute 3, through jitter, with no second on air off by more than 0.5%', async () => {
    // Arrange: João's WSL under load: monotonic time 4% fast, and timesyncd stepping the
    // wall clock back 1 s every 32 s; NTP over the internet from the track, with jitter and
    // a 238 ms delay now and then. Nothing on air counts time. The boot steps to NTP.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0.04,
      wallClockAheadOfRealTimeAtBootMs: 0,
      networkOfEachAnswer: answersOverTheInternetFromTheTrack,
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
    expect(world.serverClock.readRate(), 'the rate corrects the 4%').toBeCloseTo(1 / 1.04, 4);
  });

  it('never steps while a clock runs on air, and changes the length of a second gradually from the start', async () => {
    // Arrange: the same machine and network, with the enduro clock running on air from
    // the boot.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0.04,
      wallClockAheadOfRealTimeAtBootMs: 0,
      networkOfEachAnswer: answersOverTheInternetFromTheTrack,
    });
    world.setSomethingCountingTimeOnAir(true);
    await world.discipline.stepToRealTimeAtBoot();
    const stepsAfterTheBoot = world.serverClock.readStepCount();

    // Act: watch both clocks for 15 minutes.
    const looks = await watchTheClocksFor(world, 15 * oneMinuteMs, {
      wallClockStepEveryMs: 32_000,
    });

    // Assert: never stepped. From the first second, no second on air was more than 11 ms
    // longer or shorter than the one before: the 4% (40 ms a second) comes off over the
    // ramp's minute, and a slew turning round changes it by 10 ms at most. From minute 3
    // every second lasted 0.995–1.005 s, and by minute 12 the clock is within 50 ms.
    expect(world.serverClock.readStepCount(), 'a clock running on air is never stepped').toBe(
      stepsAfterTheBoot,
    );
    const changesFromTheSecondBefore = measureChangeFromTheSecondBefore(looks);
    expect(
      Math.max(...changesFromTheSecondBefore.map(Math.abs)),
      'the length of a second on air never changes at once',
    ).toBeLessThanOrEqual(11);
    const millisecondsPerRealSecond = measureServerMillisecondsPerRealSecond(looks.slice(3 * 60));
    expect(
      Math.min(...millisecondsPerRealSecond),
      'once the rate has settled, no second shorter than 0.995 s',
    ).toBeGreaterThanOrEqual(fewestServerMillisecondsPerRealSecond);
    expect(Math.max(...millisecondsPerRealSecond), 'nor longer than 1.005 s').toBeLessThanOrEqual(
      mostServerMillisecondsPerRealSecond,
    );
    expect(
      Math.max(...looks.slice(12 * 60).map(measureHowFarFromRealTime)),
      'the slew reaches real time all the same',
    ).toBeLessThan(50);
  });
});

describe('a machine that slept eight hours', () => {
  it('steps to real time once the difference is confirmed, when nothing on air counts time', async () => {
    // Arrange: an accurate machine, booted on NTP and past its first four answers, that
    // sleeps eight hours.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);
    world.sleepFor(eightHoursMs);

    // Act: watch both clocks for two minutes, past the next poll and its confirmation.
    const looks = await watchTheClocksFor(world, 2 * oneMinuteMs);

    // Assert: eight hours behind before the poll, on real time after the confirmation.
    const firstLook = looks[0];
    const lastLook = looks[looks.length - 1];
    if (firstLook === undefined || lastLook === undefined) {
      throw new Error('A hundred and twenty looks were taken.');
    }
    expect(
      measureHowFarFromRealTime(firstLook),
      'monotonic time did not count the sleep',
    ).toBeGreaterThan(eightHoursMs - 1_000);
    expect(measureHowFarFromRealTime(lastLook), 'the eight hours were stepped').toBeLessThan(50);
    expect(
      world.discipline.readStatus().offFromRealTimeMs,
      'nothing is left for the header to warn about',
    ).toBe(0);
  });

  it('slews instead while a clock runs, reports the difference for the header, and warns once', async () => {
    // Arrange: the same, with the enduro clock running on air.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    world.setSomethingCountingTimeOnAir(true);
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);
    world.sleepFor(eightHoursMs);

    // Act: watch both clocks for ten minutes, past eight polls.
    const looks = await watchTheClocksFor(world, 10 * oneMinuteMs);

    // Assert: no second on air off by more than 0.5% (so no jump); the header's number
    // says the server clock is still about eight hours behind real time; and the log
    // says so once, not twice at every poll.
    const millisecondsPerRealSecond = measureServerMillisecondsPerRealSecond(looks);
    expect(
      Math.max(...millisecondsPerRealSecond),
      'a clock on air must not jump eight hours',
    ).toBeLessThanOrEqual(mostServerMillisecondsPerRealSecond);
    expect(
      world.discipline.readStatus().offFromRealTimeMs,
      'the difference left is reported, positive since the server clock is behind',
    ).toBeGreaterThan(eightHoursMs - 2 * oneMinuteMs);
    const warningsAfterTheSleep = world
      .readRecordedLines()
      .filter((line) => line.level === 'warn' && line.message.includes('server clock'));
    expect(
      warningsAfterTheSleep.map((line) => line.message),
      'one warning to confirm, one that it is held on air, then nothing until it changes',
    ).toHaveLength(2);
  });

  it('steps at once on "Acertar relógio agora", although a clock runs, and tells the pages', async () => {
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
    const stepsToldBefore = world.countStepsToldToThePages();

    // Act: the producer presses "Acertar relógio agora".
    const outcome = await world.discipline.setToRealTimeNow('operador:produtor');

    // Assert: stepped by about eight hours, on real time, and the step told to the pages.
    expect(outcome.isSet, 'NTP answered, so the clock was set').toBe(true);
    expect(
      outcome.isSet && outcome.steppedByMs,
      'the step is what was left of the eight hours',
    ).toBeGreaterThan(eightHoursMs - oneMinuteMs);
    expect(
      Math.abs(world.serverClock.readCurrentTimeMs() - world.readRealTimeMs()),
      'the server clock reads real time',
    ).toBeLessThan(2);
    expect(world.countStepsToldToThePages(), 'the pages line up again at once').toBe(
      stepsToldBefore + 1,
    );
  });
});

describe('a jump of real time of a few seconds', () => {
  it('is stepped, and not taken for a rate', async () => {
    // Arrange: an accurate machine, past its first four answers, whose VM was paused 3 s
    // (real time moved on, monotonic time did not).
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);
    world.sleepFor(3_000);

    // Act: watch both clocks for ten minutes.
    const looks = await watchTheClocksFor(world, 10 * oneMinuteMs);

    // Assert: the rate is still 1 (3 s over three minutes would read as 1.7% fast), and
    // from the step (the poll at 2:56 and its confirmation 16 s later) the clock stays
    // within 50 ms of real time.
    expect(world.serverClock.readRate(), 'a jump is not a rate').toBeCloseTo(1, 6);
    expect(
      Math.max(...looks.slice(90).map(measureHowFarFromRealTime)),
      'on real time once stepped',
    ).toBeLessThan(50);
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
