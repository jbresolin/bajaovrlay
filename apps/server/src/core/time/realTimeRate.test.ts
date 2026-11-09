/**
 * The rate of real time against the machine's monotonic time (apps/server)
 *
 * What this module is for:
 *   On João's WSL the machine's clock gains about a second every 32 s, and its monotonic
 *   time may run several percent off real time too (BAJAOVRLAY-62). The server clock
 *   corrects that rate on its own, apart from the offset: from the NTP answers of the
 *   last eight minutes it measures how far real time moved while monotonic time moved
 *   (a rate of 0.96 means monotonic time runs 4% fast), and runs at that rate.
 *
 * What these tests prove (pure arithmetic on lists of answers):
 *   - A machine running 4% fast gives a rate of 1 / 1.04.
 *   - An answer with a 238 ms round trip among 12 ms ones is left out of the estimate.
 *   - With one answer, or answers less than 30 s apart, there is no estimate yet.
 *   - A gap that no clock could run (eight hours of sleep between two answers 64 s
 *     apart on monotonic time) is called implausible, not taken as a rate.
 *   - Answers older than eight minutes leave the window.
 *
 * What these tests deliberately do not cover:
 *   - How the server clock applies the rate, and when; serverClockDiscipline.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  estimateRateOfRealTime,
  keepTheAnswersOfTheRateWindow,
  type RealTimeSample,
} from './realTimeRate.js';

/** 10 October 2026, 13:00 UTC: the enduro is an hour in. */
const oneOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/** A poll every 64 s, as the server clock polls. */
const pollIntervalMs = 64_000;

/**
 * The answers of a machine whose monotonic time runs 4% fast: real time moves 1 / 1.04
 * of what monotonic time moves. One answer per poll, each with a 12 ms round trip.
 */
function buildAnswersOfAMachineFourPercentFast(numberOfPolls: number): RealTimeSample[] {
  return Array.from({ length: numberOfPolls }, (_, pollNumber) => {
    const monotonicElapsedMs = pollNumber * pollIntervalMs;
    return {
      localTimeMs: oneOClockOfTheEnduroMs + monotonicElapsedMs,
      realTimeMs: oneOClockOfTheEnduroMs + monotonicElapsedMs / 1.04,
      roundTripMs: 12,
    };
  });
}

describe('the rate of real time', () => {
  it('measures a machine whose monotonic time runs 4% fast as a rate of 1 / 1.04', () => {
    // Arrange: five polls' answers from a machine 4% fast.
    const answers = buildAnswersOfAMachineFourPercentFast(5);

    // Act: estimate the rate.
    const estimate = estimateRateOfRealTime(answers);

    // Assert: 0.9615…, so 1.04 s of monotonic time count as one second of real time.
    expect(estimate.kind, 'four minutes of answers give an estimate').toBe('estimated');
    expect(
      estimate.kind === 'estimated' && estimate.rate,
      'real time over monotonic time',
    ).toBeCloseTo(1 / 1.04, 9);
  });

  it('leaves out an answer whose round trip was far longer than the others', () => {
    // Arrange: the same machine, but the latest answer came back in 238 ms (as João's WSL
    // measured against ntp.ubuntu.com), with a one-sided delay that put it 119 ms late.
    const answers = buildAnswersOfAMachineFourPercentFast(5);
    const latestAnswer = answers[4];
    if (latestAnswer === undefined) {
      throw new Error('Five answers were built.');
    }
    answers[4] = { ...latestAnswer, realTimeMs: latestAnswer.realTimeMs + 119, roundTripMs: 238 };

    // Act: estimate the rate.
    const estimate = estimateRateOfRealTime(answers);

    // Assert: still 1 / 1.04, as if the slow answer had not been there.
    expect(
      estimate.kind === 'estimated' && estimate.rate,
      'an answer with a round trip far over the shortest must not move the rate',
    ).toBeCloseTo(1 / 1.04, 9);
  });

  const answersTooFewForAnEstimate = [
    // The boot's answer alone: one point is no rate.
    { name: 'one answer', answers: buildAnswersOfAMachineFourPercentFast(1) },
    // A confirming poll right after another: 10 s is too short to tell 0.1% from noise.
    {
      name: 'two answers 10 s apart',
      answers: [
        {
          localTimeMs: oneOClockOfTheEnduroMs,
          realTimeMs: oneOClockOfTheEnduroMs,
          roundTripMs: 12,
        },
        {
          localTimeMs: oneOClockOfTheEnduroMs + 10_000,
          realTimeMs: oneOClockOfTheEnduroMs + 10_000,
          roundTripMs: 12,
        },
      ],
    },
  ];

  it.each(answersTooFewForAnEstimate)('has no estimate yet from $name', ({ answers }) => {
    // Arrange: the answers of this row.

    // Act: estimate the rate.
    const estimate = estimateRateOfRealTime(answers);

    // Assert: not yet.
    expect(estimate.kind, 'answers less than 30 s apart give no rate yet').toBe('notYet');
  });

  it('calls eight hours of sleep between two polls implausible, not a rate', () => {
    // Arrange: two answers 64 s apart on monotonic time, which does not count a sleep,
    // but 8 h 1 min 4 s apart in real time: Windows slept, and the VM with it.
    const eightHoursMs = 8 * 60 * 60 * 1000;
    const answers: RealTimeSample[] = [
      { localTimeMs: oneOClockOfTheEnduroMs, realTimeMs: oneOClockOfTheEnduroMs, roundTripMs: 12 },
      {
        localTimeMs: oneOClockOfTheEnduroMs + pollIntervalMs,
        realTimeMs: oneOClockOfTheEnduroMs + pollIntervalMs + eightHoursMs,
        roundTripMs: 12,
      },
    ];

    // Act: estimate the rate.
    const estimate = estimateRateOfRealTime(answers);

    // Assert: implausible; past ±10% the gap is a jump, not the rate of a clock.
    expect(estimate.kind, 'no clock runs 450 times slow').toBe('implausible');
  });

  it('keeps the answers of the last eight minutes, and drops the older ones', () => {
    // Arrange: ten polls' answers, 64 s apart (9 min 36 s from first to last).
    const answers = buildAnswersOfAMachineFourPercentFast(10);
    const answersSoFar = answers.slice(0, 9);
    const newestAnswer = answers[9];
    if (newestAnswer === undefined) {
      throw new Error('Ten answers were built.');
    }

    // Act: add the tenth to the window.
    const answersKept = keepTheAnswersOfTheRateWindow(answersSoFar, newestAnswer);

    // Assert: the two answers more than eight minutes older than the newest are gone.
    expect(answersKept, 'eight minutes back from the newest answer: 8 answers').toEqual(
      answers.slice(2),
    );
  });
});
