/**
 * How long the server clock waits between two polls of NTP (BAJAOVRLAY-62). Public NTP
 * servers (NTP.br, the pool) drop or refuse a client that asks too often, so the waits
 * are those of ntpd and timesyncd, a little quicker only while the rate is not known.
 */

/** The regular interval, as ntpd and timesyncd start: 64 s. */
export const ntpPollIntervalMs = 64_000;

/**
 * The interval until the first four answers have come. The rate needs two answers at
 * least 30 s apart; at 64 s, a VM 4% fast would gain 2.5 s before the rate is known, and
 * at 16 s it gains under 0.7 s.
 */
export const pollIntervalWhileTheRateIsUnknownMs = 16_000;

/** How many answers are taken at the quicker interval, the boot's included. */
export const answersAtTheQuickerInterval = 4;

/**
 * The interval while NTP is quiet and HTTPS Date headers feed the clock (BAJAOVRLAY-76):
 * NTP's own, so NTP is still asked as often as it would be, and the web servers see a few
 * HEAD requests a minute, nowhere near anything they would refuse.
 */
export const httpsPollIntervalMs = ntpPollIntervalMs;

/** The wait before a confirming poll: at least 15 s, so no server sees a burst. */
export const intervalBeforeAConfirmationMs = 16_000;

/** A RATE kiss of death doubles the interval, up to four times (256 s); never more,
 * since the rate's eight-minute window needs two answers. */
export const largestSlowDownFactor = 4;

/** The wait before the next regular poll, for the answers taken so far and the slow-down. */
export function findTheNextPollIntervalMs(state: {
  answersTaken: number;
  slowDownFactor: number;
}): number {
  const isTheRateStillBeingLearnt = state.answersTaken < answersAtTheQuickerInterval;
  const baseIntervalMs = isTheRateStillBeingLearnt
    ? pollIntervalWhileTheRateIsUnknownMs
    : ntpPollIntervalMs;
  return baseIntervalMs * state.slowDownFactor;
}

/** The slow-down after a RATE kiss of death: twice the one before, up to four times. */
export function slowDownAfterARateKiss(slowDownFactor: number): number {
  return Math.min(slowDownFactor * 2, largestSlowDownFactor);
}
