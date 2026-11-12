/**
 * The server clock on HTTPS Date headers while NTP is quiet (apps/server)
 *
 * What this module is for:
 *   Some networks block NTP (UDP 123): KingHost, home routers until opened, a venue's
 *   router we cannot change. HTTPS gets through any network with web access, so when NTP
 *   has given no answer for one full poll interval (64 s), the discipline of the server
 *   clock is fed from the Date headers of HTTPS servers instead (BAJAOVRLAY-76), every
 *   64 s, under the very same rules: the rate, the 0.5% slew, a confirmed step only when
 *   nothing on air counts time, the 24 h cap, the warnings once. When NTP answers again it
 *   takes over. NTP stays first because it is precise to a few ms, HTTPS to tens.
 *
 * What these tests prove (on fake time, against a fake NTP and a fake HTTPS poll that
 *   answer at once, the HTTPS one off by up to ±21 ms; serverClockDiscipline.test.ts's
 *   world):
 *   - While NTP answers, HTTPS is never asked, and the clock follows NTP (a.st1.ntp.br).
 *   - With NTP quiet from the boot, HTTPS is first asked once 64 s have passed without an
 *     NTP answer, then every 64 s; the clock follows HTTPS (www.cloudflare.com).
 *   - A machine 4% fast on HTTPS alone: within 50 ms of real time from minute 5, and no
 *     second on air shorter than 0.995 s or longer than 1.005 s once the rate is known.
 *   - A difference of 5 s found by HTTPS is confirmed and stepped, and told to the pages;
 *     with a clock on air it is held, slewed at 0.5% at most, and the header is told (a
 *     second on air then lasts up to 1.006 s: the rate measured from HTTPS's answers, 64 s
 *     apart and tens of ms off, is off by up to 0.07% at first).
 *   - A time from HTTPS more than 24 h away is not taken, and warned once.
 *   - NTP back: it takes over without a jump (no step, every second 0.995–1.005 s), and
 *     HTTPS is asked no more.
 *   - Neither answering: the clock follows nothing ("sem sincronização"), the last answer
 *     still told; each outage warned once.
 *   - "Acertar relógio agora" with NTP blocked steps to HTTPS's time.
 *   - The fallback off (BAJAOVRLAY_HTTP_TIME_SERVERS=off): HTTPS never asked.
 *
 * What these tests deliberately do not cover:
 *   - The Date-header method itself; httpDateClient.test.ts.
 *   - When the header is told the clock is without sync; serverClockWithoutSync.test.ts.
 *   - The NTP-only rules these share; serverClockDiscipline.test.ts and
 *     serverClockDisciplinePolls.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  measureServerMillisecondsPerRealSecond,
  nameOfTheFakeHttpsServer,
  startAServerClockInAFakeWorld,
  tenOClockOfTheEnduroMs,
  watchTheClocksFor,
} from './fakeWorldOfTime.testSupport.js';

const oneMinuteMs = 60_000;

/** The least and the most the clock on air may move in one second of real time. */
const fewestServerMillisecondsPerRealSecond = 995 - 0.1;
const mostServerMillisecondsPerRealSecond = 1_005 + 0.1;

/**
 * The most while a held step is slewed before the rate is settled: the 0.5% slew, plus a
 * rate measured from HTTPS answers 64 s apart, each off by up to 21 ms, so off by up to
 * 0.07% at first (NTP's, 16 s apart and a few ms off, is off by far less).
 */
const mostServerMillisecondsPerRealSecondWhileHttpsLearnsTheRate = 1_005 + 1;

/** Ten years, as a box answering with no idea of the date may be wrong by. */
const tenYearsMs = Date.parse('2036-10-10T13:00:00.000Z') - tenOClockOfTheEnduroMs;

/** How far apart the two clocks are now, in ms. */
function measureHowFarFromRealTimeNow(
  world: ReturnType<typeof startAServerClockInAFakeWorld>,
): number {
  return Math.abs(world.serverClock.readCurrentTimeMs() - world.readRealTimeMs());
}

/** A machine whose venue blocks NTP from the boot on, with the HTTPS fallback on. */
async function bootAMachineWhereNtpIsBlocked(machine: {
  monotonicRunsFastBy: number;
  wallClockAheadOfRealTimeAtBootMs: number;
}) {
  const world = startAServerClockInAFakeWorld({ ...machine, isHttpsFallbackOn: true });
  world.setNtpReachable(false);
  await world.discipline.stepToRealTimeAtBoot();
  return world;
}

describe('while NTP answers', () => {
  it('never asks HTTPS, and follows NTP', async () => {
    // Arrange: an accurate machine with the fallback on, booted on NTP.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
      isHttpsFallbackOn: true,
    });
    await world.discipline.stepToRealTimeAtBoot();

    // Act: ten minutes of polls.
    await vi.advanceTimersByTimeAsync(10 * oneMinuteMs);

    // Assert: no HTTPS poll; the source is NTP's first server, named as the operator reads it.
    expect(world.readHttpsPollsMadeAtMs(), 'HTTPS is only a fallback').toEqual([]);
    expect(world.discipline.readStatus().source, 'the clock follows NTP').toMatchObject({
      following: 'ntp',
      lastAnswer: { source: 'ntp', serverName: 'a.st1.ntp.br' },
    });
  });
});

describe('with NTP quiet', () => {
  it('asks HTTPS once NTP has been quiet for 64 s, then every 64 s, and follows it', async () => {
    // Arrange: an accurate machine at a venue that blocks NTP.
    const world = await bootAMachineWhereNtpIsBlocked({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });

    // Act: five minutes pass.
    await vi.advanceTimersByTimeAsync(5 * oneMinuteMs);

    // Assert: the first HTTPS poll at 64 s, then 64 s apart; the clock follows HTTPS.
    expect(world.readHttpsPollsMadeAtMs(), 'a full NTP poll interval first, then 64 s').toEqual([
      64_000, 128_000, 192_000, 256_000,
    ]);
    expect(world.discipline.readStatus().source, 'the clock follows HTTPS').toMatchObject({
      following: 'https',
      lastAnswer: { source: 'https', serverName: nameOfTheFakeHttpsServer },
    });
  });

  it('keeps a machine 4% fast on real time from HTTPS alone, every second 0.995–1.005 s', async () => {
    // Arrange: a VM whose monotonic time runs 4% fast, at a venue that blocks NTP.
    const world = await bootAMachineWhereNtpIsBlocked({
      monotonicRunsFastBy: 0.04,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });

    // Act: twelve minutes pass, looking at both clocks every second.
    const looks = await watchTheClocksFor(world, 12 * oneMinuteMs);

    // Assert: from minute 7 (HTTPS from minute 1, the rate known a few answers later, then
    // the slew), within 50 ms of real time at every look, and every second on air
    // 0.995–1.005 s.
    const looksFromMinuteSeven = looks.slice(7 * 60);
    const farthestMs = Math.max(
      ...looksFromMinuteSeven.map((look) => Math.abs(look.serverTimeMs - look.realTimeMs)),
    );
    expect(farthestMs, 'within 50 ms of real time from HTTPS alone').toBeLessThan(50);
    const secondsOnAir = measureServerMillisecondsPerRealSecond(looksFromMinuteSeven);
    expect(Math.min(...secondsOnAir), 'no second on air too short').toBeGreaterThan(
      fewestServerMillisecondsPerRealSecond,
    );
    expect(Math.max(...secondsOnAir), 'no second on air too long').toBeLessThan(
      mostServerMillisecondsPerRealSecond,
    );
  });

  it('steps a confirmed 5 s found by HTTPS, and tells the pages', async () => {
    // Arrange: a machine whose wall clock is 5 s behind at boot, at a venue that blocks NTP.
    const world = await bootAMachineWhereNtpIsBlocked({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: -5_000,
    });

    // Act: two minutes pass (HTTPS at 64 s, its confirmation 16 s later).
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);

    // Assert: confirmed by a second HTTPS poll 16 s after the first, then stepped onto
    // real time, within HTTPS's tens of ms, and one step told to the pages.
    expect(world.readHttpsPollsMadeAtMs().slice(0, 2), 'a confirmation 16 s later').toEqual([
      64_000, 80_000,
    ]);
    expect(measureHowFarFromRealTimeNow(world), 'on real time, as HTTPS tells it').toBeLessThan(30);
    expect(world.countStepsToldToThePages(), 'one step, told to the pages').toBe(1);
  });

  it('holds that step while a clock is on air: slewed at 0.5% at most, the header told', async () => {
    // Arrange: the same machine, 5 s behind, with a race clock running on program.
    const world = await bootAMachineWhereNtpIsBlocked({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: -5_000,
    });
    world.setSomethingCountingTimeOnAir(true);

    // Act: three minutes pass, looking at both clocks every second.
    const looks = await watchTheClocksFor(world, 3 * oneMinuteMs);

    // Assert: never stepped; no second on air longer than 1.006 s (the 0.5% slew and the
    // rate HTTPS is still learning); the header is told how far off the clock still is;
    // the log says so once.
    expect(world.countStepsToldToThePages(), 'no step while time counts on air').toBe(0);
    const secondsOnAir = measureServerMillisecondsPerRealSecond(looks);
    expect(Math.max(...secondsOnAir), 'a slew of 0.5% at most, and the rate').toBeLessThan(
      mostServerMillisecondsPerRealSecondWhileHttpsLearnsTheRate,
    );
    expect(
      world.discipline.readStatus().offFromRealTimeMs,
      'the header warns of the seconds still off',
    ).toBeGreaterThan(4_000);
    const heldWarnings = world
      .readRecordedLines()
      .filter((line) => line.message.includes('something on air counts time'));
    expect(heldWarnings, 'warned once').toHaveLength(1);
  });

  it('does not take a time from HTTPS more than 24 h away, and warns once', async () => {
    // Arrange: an accurate machine at a venue that blocks NTP, behind a proxy whose clock
    // is ten years ahead.
    const world = await bootAMachineWhereNtpIsBlocked({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    world.makeHttpsWrongBy(tenYearsMs);

    // Act: ten minutes pass.
    await vi.advanceTimersByTimeAsync(10 * oneMinuteMs);

    // Assert: still on real time; one warning.
    expect(measureHowFarFromRealTimeNow(world), 'never followed on its own').toBeLessThan(2);
    const warnings = world
      .readRecordedLines()
      .filter((line) => line.level === 'warn' && line.message.includes('24 h'));
    expect(warnings, 'once, not at every poll').toHaveLength(1);
  });
});

describe('when NTP answers again', () => {
  it('takes over without a jump, and HTTPS is asked no more', async () => {
    // Arrange: a machine 4% fast on HTTPS for ten minutes.
    const world = await bootAMachineWhereNtpIsBlocked({
      monotonicRunsFastBy: 0.04,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await vi.advanceTimersByTimeAsync(10 * oneMinuteMs);
    const httpsPollsBefore = world.readHttpsPollsMadeAtMs().length;
    const stepsBefore = world.countStepsToldToThePages();

    // Act: the venue opens UDP 123; five minutes pass, looking every second.
    world.setNtpReachable(true);
    const looks = await watchTheClocksFor(world, 5 * oneMinuteMs);

    // Assert: no step, every second 0.995–1.005 s, NTP followed, HTTPS asked no more.
    expect(world.countStepsToldToThePages(), 'no step when NTP takes over').toBe(stepsBefore);
    const secondsOnAir = measureServerMillisecondsPerRealSecond(looks);
    expect(Math.min(...secondsOnAir), 'no second on air too short').toBeGreaterThan(
      fewestServerMillisecondsPerRealSecond,
    );
    expect(Math.max(...secondsOnAir), 'no second on air too long').toBeLessThan(
      mostServerMillisecondsPerRealSecond,
    );
    expect(world.discipline.readStatus().source.following, 'NTP followed again').toBe('ntp');
    expect(world.readHttpsPollsMadeAtMs().length, 'HTTPS asked no more').toBe(httpsPollsBefore);
    expect(
      world.readRecordedLines().some((line) => line.message.includes('NTP answers again')),
      'the log says NTP is back',
    ).toBe(true);
  });
});

describe('when neither answers', () => {
  it('follows nothing, still tells the last answer, and warns of each outage once', async () => {
    // Arrange: an accurate machine booted on NTP, the fallback on.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
      isHttpsFallbackOn: true,
    });
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);

    // Act: the uplink goes down altogether for half an hour.
    world.setNtpReachable(false);
    world.setHttpsReachable(false);
    await vi.advanceTimersByTimeAsync(30 * oneMinuteMs);

    // Assert: following nothing, the last answer NTP's; one warning for NTP's silence, one
    // for NTP quiet for a full interval, one for HTTPS.
    expect(world.discipline.readStatus().source, 'the computer’s own clock').toMatchObject({
      following: 'none',
      lastAnswer: { source: 'ntp', serverName: 'a.st1.ntp.br' },
    });
    const warnings = world.readRecordedLines().filter((line) => line.level === 'warn');
    expect(
      warnings.map((line) => line.message),
      'each outage warned once, not at every poll',
    ).toEqual([
      'NTP gave no answer; the server clock runs on at its last rate',
      'NTP quiet for a full poll interval; the server clock follows the Date headers of HTTPS servers',
      'HTTPS Date headers gave no answer either; the server clock runs on at its last rate',
    ]);
  });
});

describe('"Acertar relógio agora" with NTP blocked', () => {
  it('steps to the time HTTPS tells', async () => {
    // Arrange: a machine 5 s behind at a venue that blocks NTP; a clock on air held the
    // step.
    const world = await bootAMachineWhereNtpIsBlocked({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: -5_000,
    });
    world.setSomethingCountingTimeOnAir(true);
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);

    // Act: the producer presses "Acertar relógio agora".
    const outcome = await world.discipline.setToRealTimeNow('operador:produtor');

    // Assert: set, onto real time as HTTPS tells it.
    expect(outcome.isSet, 'HTTPS answered for NTP').toBe(true);
    expect(measureHowFarFromRealTimeNow(world), 'on real time').toBeLessThan(30);
  });
});

describe('with the fallback off', () => {
  it('never asks HTTPS, and the clock follows nothing once NTP is quiet', async () => {
    // Arrange: a machine at a venue that blocks NTP, BAJAOVRLAY_HTTP_TIME_SERVERS=off.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
      isHttpsFallbackOn: false,
    });
    world.setNtpReachable(false);
    await world.discipline.stepToRealTimeAtBoot();

    // Act: five minutes pass.
    await vi.advanceTimersByTimeAsync(5 * oneMinuteMs);

    // Assert: no HTTPS; nothing followed, no answer ever.
    expect(world.readHttpsPollsMadeAtMs(), 'HTTPS is off').toEqual([]);
    expect(world.discipline.readStatus().source, 'the computer’s own clock').toEqual({
      following: 'none',
      lastAnswer: null,
    });
  });
});
