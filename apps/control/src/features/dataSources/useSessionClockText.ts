import {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  formatClockTimeAsHoursMinutesSeconds,
} from '@bajaovrlay/shared/clock';

import { useServerAlignedTimeMs } from './useServerAlignedTimeMs';

// The text shows whole seconds, so reading "now" again once a second is enough.
const millisecondsBetweenDraws = 1_000;

/**
 * Gives the session card the H:MM:SS its clock shows right now, worked out from one
 * reading with the very sum and text the race clock uses on air (packages/shared/src/
 * clock), so the card and the screen agree. A session's clock is a ClockReading as it
 * stands, so the caller hands it over whole.
 *
 * "Now" is read once a second on the server's clock (useServerAlignedTimeMs.ts), as the
 * reading's moment is the server's. A held clock (red flag, the end) shows its reading
 * whatever the time. What could go wrong: draws are a second apart and not in step with
 * the graphic's frames, so the card can trail the screen by up to a second; and a new
 * reading stamped after the last read of "now" would count from a moment before it,
 * which is why the session card is drawn anew for each snapshot (DataSourceDetail.tsx).
 */
export function useSessionClockText(clock: ClockReading): string {
  const nowMs = useServerAlignedTimeMs(millisecondsBetweenDraws);
  const clockTimeMs = computeClockTimeMsAtWallClock(clock, nowMs);
  return formatClockTimeAsHoursMinutesSeconds(clockTimeMs, clock.clockMode);
}
