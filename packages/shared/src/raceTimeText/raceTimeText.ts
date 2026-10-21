/**
 * Race times as the timing screen writes them: to the tenth of a second, cut and never
 * rounded, with a decimal comma. Baja's timing records line passes with limited accuracy,
 * so the milliseconds are false precision, and timing screens cut rather than round (the
 * gap rule of PR #17, the same as the Fontes page's). Whole-number steps instead of
 * toFixed or toLocaleString, whose rounding would turn 12 399 into "12,4".
 *
 * Every function takes a whole number of milliseconds from 0 up; checking the input is
 * the caller's job (the binding transforms refuse anything else with a pt-BR reason).
 */

const millisecondsPerTenthOfASecond = 100;
const tenthsPerSecond = 10;
const secondsPerMinute = 60;
const minutesPerHour = 60;

/** The whole seconds and the tenth of a duration, the rest of the milliseconds cut. */
function cutDurationToTheTenth(durationMs: number): { wholeSeconds: number; tenth: number } {
  const wholeTenths = Math.floor(durationMs / millisecondsPerTenthOfASecond);
  return {
    wholeSeconds: Math.floor(wholeTenths / tenthsPerSecond),
    tenth: wholeTenths % tenthsPerSecond,
  };
}

/**
 * Writes a duration as seconds to the tenth, cut, with a decimal comma: 12 399 ms reads
 * "12,3", 75 300 ms reads "75,3" (past a minute a gap stays in seconds). The body of a
 * gap text; the caller adds the "+" and, where the face allows it, the unit.
 */
export function writeSecondsToTheTenthCutAsText(durationMs: number): string {
  const { wholeSeconds, tenth } = cutDurationToTheTenth(durationMs);
  return `${wholeSeconds},${tenth}`;
}

/**
 * Writes a lap time as the timing screen does: minutes, two-digit seconds and the tenth,
 * cut ("4:38,2" for 278 299 ms), with the hour in front past an hour ("1:02:03,4"). A lap
 * under a minute keeps its 0 minutes ("0:59,9"), so the text never reads as hours.
 */
export function writeLapTimeAsText(durationMs: number): string {
  const { wholeSeconds, tenth } = cutDurationToTheTenth(durationMs);
  const seconds = wholeSeconds % secondsPerMinute;
  const totalMinutes = Math.floor(wholeSeconds / secondsPerMinute);
  const minutes = totalMinutes % minutesPerHour;
  const hours = Math.floor(totalMinutes / minutesPerHour);
  const twoDigitSeconds = String(seconds).padStart(2, '0');
  if (hours === 0) {
    return `${minutes}:${twoDigitSeconds},${tenth}`;
  }
  const twoDigitMinutes = String(minutes).padStart(2, '0');
  return `${hours}:${twoDigitMinutes}:${twoDigitSeconds},${tenth}`;
}
