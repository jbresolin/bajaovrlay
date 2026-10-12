/**
 * Turns a clock time in milliseconds into the H:MM:SS text shown on air, dropping the
 * hours while they are zero ("12:00", "1:00:00"). Negative times show as "0:00".
 */
// Which whole second to show is shared with the server, which must keep the number on
// screen when a clock on air is turned around. Only the `/clock` entry is imported: it
// carries no Zod and nothing else of shared.
import { countWholeSecondsClockShows } from '@bajaovrlay/shared/clock';

import type { ClockMode } from './raceClockModel.js';

const secondsPerMinute = 60;
const secondsPerHour = 3600;

/**
 * Formats milliseconds as H:MM:SS (or M:SS under an hour). An elapsed clock drops partial
 * seconds; a countdown rounds them up, so it shows 0:01 until the race is really over
 * (countWholeSecondsClockShows in packages/shared, the one copy of that rounding).
 */
export function formatClockTimeAsHoursMinutesSeconds(
  clockTimeMs: number,
  clockMode: ClockMode,
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
