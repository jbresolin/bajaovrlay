/**
 * Works out a race clock's time at any moment from one reading ("at wall-clock time W
 * the clock read T"), so the server only has to send a reading when something changes.
 *
 * This is the one copy of the sum. The race clock graphic runs it on every frame and
 * the server runs it when an update must not make the clock jump (carryClockForward).
 * It imports nothing on purpose: the graphic bundles this file, and every dependency
 * there is a frame-drop risk in OBS.
 */

/** One reading of a race clock, as the race clock's data holds it. */
export type ClockReading = {
  /** Whether the clock counts time since the start or time left until the end. */
  clockMode: 'elapsed' | 'remaining';
  /** The time the clock read, in milliseconds, at `referenceWallClockMs`. */
  referenceTimeMs: number;
  /** The wall-clock moment of the reading, in milliseconds since 1970. */
  referenceWallClockMs: number;
  /** False for a held clock, which shows the reading however much time passes. */
  running: boolean;
};

/**
 * Returns the clock time, in ms, at `nowWallClockMs`. A held clock returns the reading;
 * a running one moves up (elapsed) or down (remaining) by the time since the reading.
 * The result may be negative for a countdown; whoever shows or stores it clamps it.
 *
 * What could go wrong: the reading's wall clock is the server's and, in the graphic,
 * `now` is read on the OBS machine. If those two clocks disagree, the shown time is off
 * by the difference; that is why the graphic passes readServerAlignedTimeMs() here
 * (serverAlignedTime.ts) and never its own Date.now().
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
