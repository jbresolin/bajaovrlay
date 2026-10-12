/**
 * Which whole second a race clock shows for a time in milliseconds.
 *
 * This is the one copy of the rounding. The race clock graphic uses it to write its
 * text and the server uses it when a clock on air is turned around (carryClockForward),
 * so the number on screen is the same just before and just after the press.
 * It imports nothing on purpose: the graphic bundles this file, and every dependency
 * there is a frame-drop risk in OBS.
 */

const millisecondsPerSecond = 1000;

/**
 * Returns the number of whole seconds a clock in `clockMode` shows for `clockTimeMs`.
 * Elapsed time floors: the clock never shows a second that has not fully passed.
 * Remaining time ceils: 0:00 appears only when nothing is left, never during the last
 * second, so the audience never sees a finished countdown while cars are still racing.
 * What could go wrong: a negative time is not clamped here; whoever calls clamps first.
 */
export function countWholeSecondsClockShows(
  clockTimeMs: number,
  clockMode: 'elapsed' | 'remaining',
): number {
  const seconds = clockTimeMs / millisecondsPerSecond;
  if (clockMode === 'remaining') {
    return Math.ceil(seconds);
  }
  return Math.floor(seconds);
}
