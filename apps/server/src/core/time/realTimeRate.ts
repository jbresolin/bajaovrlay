/**
 * The rate of real time against the machine's monotonic time, from NTP answers: how far
 * real time moved while monotonic time moved. Below 1 the machine's monotonic time runs
 * fast (0.96 for 4% fast), above 1 slow. Pure arithmetic; serverClockDiscipline.ts
 * decides when to apply it.
 *
 * Why apart from the offset (BAJAOVRLAY-62): on João's WSL the clock gains about a second
 * every 32 s. Correcting that through the offset alone would need a slew of 3%, which a
 * second on air would show; as a rate it is the fix itself, and the offset is left with
 * only what the rate has not explained, which the 0.5% slew covers.
 */

/** One NTP answer, as the rate needs it. */
export type RealTimeSample = {
  /** The machine's monotonic time when the answer arrived. */
  localTimeMs: number;
  /** Real time at that moment, by the answer: the local time plus its offset. */
  realTimeMs: number;
  roundTripMs: number;
};

/** The estimate: a rate, not yet one, or a jump that no clock's rate could explain. */
export type RateEstimate =
  { kind: 'estimated'; rate: number } | { kind: 'notYet' } | { kind: 'implausible'; rate: number };

/** How far back answers count. Long enough that one answer moves the rate little. */
export const rateWindowMs = 8 * 60_000;

/** The most the rate may differ from 1. Past it, the gap is a sleep or a jump. */
export const largestRateCorrection = 0.1;

/** Answers closer than this give no rate: a few ms of noise would be a large error. */
const shortestSpanForARateMs = 30_000;

/** A round trip this many ms over the shortest is an outlier on a fast network. */
const roundTripAllowanceMs = 20;

/**
 * Adds the newest answer to the window and drops every answer more than eight minutes
 * (of monotonic time) older than it. The list given is not changed.
 */
export function keepTheAnswersOfTheRateWindow(
  answersSoFar: readonly RealTimeSample[],
  newestAnswer: RealTimeSample,
): RealTimeSample[] {
  const oldestTimeKeptMs = newestAnswer.localTimeMs - rateWindowMs;
  const answersStillInTheWindow = answersSoFar.filter(
    (answer) => answer.localTimeMs >= oldestTimeKeptMs,
  );
  return [...answersStillInTheWindow, newestAnswer];
}

/**
 * Estimates the rate from the window's answers: real time moved over monotonic time moved,
 * between the oldest and the newest answer that are not outliers. An outlier is an answer
 * whose round trip was more than twice the window's shortest and more than 20 ms over it:
 * its offset may be wrong by half the extra delay. The answers must be oldest first.
 */
export function estimateRateOfRealTime(answers: readonly RealTimeSample[]): RateEstimate {
  const longestRoundTripKeptMs = findTheLongestRoundTripKeptMs(answers);
  const answersKept = answers.filter((answer) => answer.roundTripMs <= longestRoundTripKeptMs);
  const oldestAnswer = answersKept[0];
  const newestAnswer = answersKept[answersKept.length - 1];
  if (oldestAnswer === undefined || newestAnswer === undefined) {
    return { kind: 'notYet' };
  }
  const monotonicMovedMs = newestAnswer.localTimeMs - oldestAnswer.localTimeMs;
  if (monotonicMovedMs < shortestSpanForARateMs) {
    return { kind: 'notYet' };
  }
  const realTimeMovedMs = newestAnswer.realTimeMs - oldestAnswer.realTimeMs;
  const rate = realTimeMovedMs / monotonicMovedMs;
  if (Math.abs(rate - 1) > largestRateCorrection) {
    return { kind: 'implausible', rate };
  }
  return { kind: 'estimated', rate };
}

/**
 * The longest round trip not counted as an outlier among these answers: twice the
 * shortest, and at least 20 ms over it. The discipline leaves a small difference told by
 * a slower answer aside for the same reason the rate does.
 */
export function findTheLongestRoundTripKeptMs(answers: readonly RealTimeSample[]): number {
  const shortestRoundTripMs = Math.min(...answers.map((answer) => answer.roundTripMs));
  return Math.max(shortestRoundTripMs * 2, shortestRoundTripMs + roundTripAllowanceMs);
}
