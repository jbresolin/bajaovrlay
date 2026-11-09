/**
 * When the server clock asks NTP, and what it does not take from it (apps/server)
 *
 * What this module is for:
 *   The discipline of the server clock (serverClockDiscipline.ts, BAJAOVRLAY-62) polls
 *   NTP. Public servers (NTP.br, the pool) answer a client that asks too often with a RATE
 *   kiss of death, or not at all, so the polls are spaced; and an NTP box at the track
 *   that has lost its GPS fix can tell a time years away, which must never be stepped to
 *   on its own.
 *
 * What these tests prove (on fake time, against a fake NTP that answers at once):
 *   - Until four answers have given a rate, a poll every 16 s; then every 64 s.
 *   - The boot and "Acertar relógio agora" ask one question; a regular poll asks four.
 *   - A big difference is confirmed by a poll 16 s later that asks another server first.
 *   - Before a step, the discipline asks whether that step would make anything on air jump
 *     (a countdown at 0:00 counts again after a step back), with the step it would make.
 *   - A RATE kiss of death doubles the interval, up to 256 s.
 *   - A time more than 24 h from the server clock is never stepped or slewed to on its
 *     own, at boot or later: it is reported for the header and warned once; "Acertar
 *     relógio agora" steps to it.
 *
 * What these tests deliberately do not cover:
 *   - How the clock moves with the answers it takes; serverClockDiscipline.test.ts.
 *   - The 2 s between the questions of one poll; ntpPolls.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  nameOfTheFakeNtpServer,
  startAServerClockInAFakeWorld,
  tenOClockOfTheEnduroMs,
} from './fakeWorldOfTime.testSupport.js';

const oneMinuteMs = 60_000;

/** Ten years, as a track-side NTP box with no GPS fix may be wrong by. */
const tenYearsMs = Date.parse('2036-10-10T13:00:00.000Z') - tenOClockOfTheEnduroMs;

/** The time between each poll and the one before, in monotonic ms. */
function measureTheGapsBetweenPolls(polls: readonly { monotonicSinceBootMs: number }[]): number[] {
  return polls
    .slice(1)
    .map(
      (poll, pollNumber) =>
        poll.monotonicSinceBootMs - (polls[pollNumber]?.monotonicSinceBootMs ?? 0),
    );
}

describe('when the server clock polls NTP', () => {
  it('polls every 16 s until four answers have come, then every 64 s', async () => {
    // Arrange: an accurate machine, booted on NTP (its first answer).
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();

    // Act: five minutes pass.
    await vi.advanceTimersByTimeAsync(5 * oneMinuteMs);

    // Assert: the boot's poll, three at 16 s (four answers in all), then 64 s apart.
    const gapsMs = measureTheGapsBetweenPolls(world.readPollsMade());
    expect(gapsMs.slice(0, 3), 'quick polls while the rate is not known').toEqual([
      16_000, 16_000, 16_000,
    ]);
    expect(new Set(gapsMs.slice(3)), 'then the interval of ntpd and timesyncd').toEqual(
      new Set([64_000]),
    );
  });

  it('asks one question at boot and on "Acertar relógio agora", four at a regular poll', async () => {
    // Arrange: an accurate machine, booted on NTP.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();

    // Act: one regular poll comes, then the producer presses "Acertar relógio agora".
    await vi.advanceTimersByTimeAsync(16_000);
    await world.discipline.setToRealTimeNow('operador:produtor');

    // Assert: 1, 4, 1: the boot waits 3 s at most, and the button must answer quickly.
    expect(
      world.readPollsMade().map((poll) => poll.questionsPerServer),
      'quick polls where someone waits, four questions otherwise',
    ).toEqual([1, 4, 1]);
  });

  it('confirms a big difference 16 s later, asking another server first', async () => {
    // Arrange: an accurate machine past its first four answers, then a 3 s sleep.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);
    world.sleepFor(3_000);
    const pollsBefore = world.readPollsMade().length;

    // Act: the next poll finds the 3 s; two minutes pass.
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);

    // Assert: the poll after the one that found it came 16 s later (no sooner: public
    // servers refuse a burst), with the first server to be asked last; then it was stepped.
    const pollsAfter = world.readPollsMade().slice(pollsBefore);
    const [pollThatFoundIt, confirmingPoll] = pollsAfter;
    expect(
      (confirmingPoll?.monotonicSinceBootMs ?? 0) - (pollThatFoundIt?.monotonicSinceBootMs ?? 0),
      'the confirmation waits 16 s',
    ).toBe(16_000);
    expect(confirmingPoll?.serverToAskLast, 'a second opinion, from another server').toBe(
      nameOfTheFakeNtpServer,
    );
    expect(pollThatFoundIt?.serverToAskLast, 'a regular poll starts at the first server').toBe(
      undefined,
    );
    expect(
      Math.abs(world.serverClock.readCurrentTimeMs() - world.readRealTimeMs()),
      'then stepped',
    ).toBeLessThan(2);
  });

  it('asks what is on air about the very step it would make', async () => {
    // Arrange: an accurate machine past its first answers, whose clock then runs 3 s ahead
    // of real time (NTP's real time jumps back by 3 s, as after a wrong manual setting).
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);
    world.sleepFor(-3_000);

    // Act: the next poll and its confirmation come.
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);

    // Assert: asked about a step back of about 3 s, so a countdown at 0:00 for less than
    // 3 s counts (it would show time again).
    const stepConsidered = world.readStepsConsidered()[0] ?? 0;
    expect(stepConsidered, 'the step considered is back by about 3 s').toBeLessThan(-2_900);
    expect(stepConsidered, 'and no more').toBeGreaterThan(-3_100);
  });

  it('polls half as often after a RATE kiss of death, and again, up to every 256 s', async () => {
    // Arrange: an accurate machine past its first four answers; from now on, every poll
    // brings a RATE kiss from one server ("you ask too often").
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);
    world.makeNtpAskToSlowDown(true);
    const pollsBefore = world.readPollsMade().length;

    // Act: twenty minutes pass.
    await vi.advanceTimersByTimeAsync(20 * oneMinuteMs);

    // Assert: 128 s, then 256 s, and never longer.
    const gapsMs = measureTheGapsBetweenPolls(world.readPollsMade().slice(pollsBefore - 1));
    expect(gapsMs.slice(0, 4), 'doubled, doubled again, then held').toEqual([
      64_000, 128_000, 256_000, 256_000,
    ]);
  });
});

describe('a time from NTP more than 24 h away', () => {
  it('is not stepped to at boot: the server starts on its wall clock and warns', async () => {
    // Arrange: a machine on the right time, and a track-side NTP box ten years ahead.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    world.makeNtpWrongBy(tenYearsMs);

    // Act: the boot asks NTP.
    await world.discipline.stepToRealTimeAtBoot();

    // Assert: still on the wall clock, with a warning, and nothing told to the pages.
    expect(world.serverClock.readCurrentTimeMs(), 'not ten years ahead').toBe(
      tenOClockOfTheEnduroMs,
    );
    expect(
      world
        .readRecordedLines()
        .some((line) => line.level === 'warn' && line.message.includes('24 h')),
      'the log must say why it was not stepped',
    ).toBe(true);
    expect(world.countStepsToldToThePages(), 'no step').toBe(0);
  });

  it('is never taken later on its own, is reported for the header, and is warned once', async () => {
    // Arrange: a machine booted on NTP; then its NTP box loses its GPS fix and answers
    // ten years ahead.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
    });
    await world.discipline.stepToRealTimeAtBoot();
    world.makeNtpWrongBy(tenYearsMs);

    // Act: ten minutes of polls.
    await vi.advanceTimersByTimeAsync(10 * oneMinuteMs);

    // Assert: on real time still (no step, no slew towards it); the header's number is the
    // ten years; one warning.
    expect(
      Math.abs(world.serverClock.readCurrentTimeMs() - world.readRealTimeMs()),
      'NTP far off is never followed on its own',
    ).toBeLessThan(2);
    expect(world.discipline.readStatus().offFromRealTimeMs, 'the header warns').toBeGreaterThan(
      tenYearsMs - oneMinuteMs,
    );
    const warnings = world
      .readRecordedLines()
      .filter((line) => line.level === 'warn' && line.message.includes('24 h'));
    expect(warnings, 'once, not at every poll').toHaveLength(1);
  });

  it('is stepped to on "Acertar relógio agora": the producer decided', async () => {
    // Arrange: a machine whose wall clock was ten years behind at boot (a dead clock
    // battery), so NTP's true time was refused.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: -tenYearsMs,
    });
    await world.discipline.stepToRealTimeAtBoot();

    // Act: the producer presses "Acertar relógio agora".
    const outcome = await world.discipline.setToRealTimeNow('operador:produtor');

    // Assert: stepped by the ten years, onto real time.
    expect(outcome.isSet, 'NTP answered').toBe(true);
    expect(
      Math.abs(world.serverClock.readCurrentTimeMs() - world.readRealTimeMs()),
      'the server clock reads real time',
    ).toBeLessThan(2);
  });
});
