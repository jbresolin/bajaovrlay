/**
 * Turns a clock time in milliseconds into the H:MM:SS text a race clock shows, dropping
 * the hours while they are zero ("12:00", "1:00:00"). Negative times show as "0:00".
 *
 * It lives here, beside the sum and the rounding, because two places must write the same
 * text for the same moment: the race clock graphic on air, and the session card of the
 * control page's "Fontes" page. Like every file of this folder it imports nothing from
 * outside it, so the graphic can bundle it.
 */
import type { ClockReading } from './clockExtrapolation.js';
import { countWholeSecondsClockShows } from './clockWholeSeconds.js';

const secondsPerMinute = 60;
const secondsPerHour = 3600;

/**
 * Formats milliseconds as H:MM:SS (or M:SS under an hour). An elapsed clock drops partial
 * seconds; a countdown rounds them up, so it shows 0:01 until the race is really over
 * (countWholeSecondsClockShows, the one copy of that rounding).
 */
export function formatClockTimeAsHoursMinutesSeconds(
  clockTimeMs: number,
  clockMode: ClockReading['clockMode'],
): string {
  // A countdown extrapolated past zero must never show a minus sign on air.
  const clockTimeNeverBelowZeroMs = Math.max(0, clockTimeMs);
  const totalWholeSeconds = countWholeSecondsClockShows(clockTimeNeverBelowZeroMs, clockMode);

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
