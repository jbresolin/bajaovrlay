/**
 * Works out the clock time at any moment from one reading ("at wall-clock time W the
 * clock read T"), so the server only has to send a reading when something changes.
 */
import type { RaceClockData } from './raceClockModel.js';

type ClockReading = Pick<
  RaceClockData,
  'clockMode' | 'referenceTimeMs' | 'referenceWallClockMs' | 'running'
>;

/**
 * Returns the clock time, in ms, at `nowWallClockMs`. A held clock returns the reading;
 * a running one moves up (elapsed) or down (remaining) by the time since the reading.
 * The result may be negative for a countdown; the formatter clamps it to 0:00.
 *
 * What could go wrong: the reading's wall clock is the server's and `now` is the OBS
 * machine's. If those two clocks disagree, the shown time is off by the difference.
 */
export function computeClockTimeMsAtWallClock(
  reading: ClockReading,
  nowWallClockMs: number,
): number {
  if (!reading.running) {
    return reading.referenceTimeMs;
  }

  const timeSinceReadingMs = nowWallClockMs - reading.referenceWallClockMs;
  if (reading.clockMode === 'elapsed') {
    return reading.referenceTimeMs + timeSinceReadingMs;
  }
  return reading.referenceTimeMs - timeSinceReadingMs;
}
