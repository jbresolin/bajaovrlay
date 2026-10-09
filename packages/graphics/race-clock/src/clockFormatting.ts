/**
 * Turns a clock time in milliseconds into the H:MM:SS text shown on air, dropping the
 * hours while they are zero ("12:00", "1:00:00"). Negative times show as "0:00".
 */
import type { ClockMode } from './raceClockModel.js';

const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const secondsPerHour = 3600;

/**
 * Formats milliseconds as H:MM:SS (or M:SS under an hour). An elapsed clock drops partial
 * seconds; a countdown rounds them up, so it shows 0:01 until the race is really over.
 */
export function formatClockTimeAsHoursMinutesSeconds(
  clockTimeMs: number,
  clockMode: ClockMode,
): string {
  // A countdown extrapolated past zero must never show a minus sign on air.
  const clockTimeNeverBelowZeroMs = Math.max(0, clockTimeMs);
  const totalWholeSeconds = countWholeSecondsToShow(clockTimeNeverBelowZeroMs, clockMode);

  const hours = Math.floor(totalWholeSeconds / secondsPerHour);
  const minutes = Math.floor((totalWholeSeconds % secondsPerHour) / secondsPerMinute);
  const seconds = totalWholeSeconds % secondsPerMinute;
  const twoDigitSeconds = String(seconds).padStart(2, '0');

  if (hours === 0) {
    return `${minutes}:${twoDigitSeconds}`;
  }
  const twoDigitMinutes = String(minutes).padStart(2, '0');
  return `${hours}:${twoDigitMinutes}:${twoDigitSeconds}`;
}

/**
 * Elapsed time floors: the clock never shows a second that has not fully passed.
 * Remaining time ceils: 0:00 appears only when nothing is left, never during the last
 * second, so the audience never sees a finished countdown while cars are still racing.
 */
function countWholeSecondsToShow(clockTimeMs: number, clockMode: ClockMode): number {
  const seconds = clockTimeMs / millisecondsPerSecond;
  if (clockMode === 'remaining') {
    return Math.ceil(seconds);
  }
  return Math.floor(seconds);
}
