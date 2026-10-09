/**
 * Turns a clock time in milliseconds into the H:MM:SS text shown on air, dropping the
 * hours while they are zero ("12:00", "1:00:00"). Negative times show as "0:00".
 */

const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const secondsPerHour = 3600;

/**
 * Formats milliseconds as H:MM:SS (or M:SS under an hour). Partial seconds are dropped,
 * never rounded up, so the clock never shows a second that has not fully passed.
 */
export function formatClockTimeAsHoursMinutesSeconds(clockTimeMs: number): string {
  // A countdown extrapolated past zero must never show a minus sign on air.
  const clockTimeNeverBelowZeroMs = Math.max(0, clockTimeMs);
  const totalWholeSeconds = Math.floor(clockTimeNeverBelowZeroMs / millisecondsPerSecond);

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
