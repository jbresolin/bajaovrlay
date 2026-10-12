/**
 * The time a clock on air shows right now, for the time field of "Edição rápida". The
 * sum and the rounding are the one copy in packages/shared/src/clock, the same the
 * graphic runs on every frame and the server runs when it carries a clock forward. This
 * file only reads the data on air through the keys found in the graphic's manifest
 * (clockFieldsOfGraphic.ts) and writes the result as mm:ss.
 */
import {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  countWholeSecondsClockShows,
} from '@bajaovrlay/shared';

import { formatMillisecondsAsMinutesAndSeconds } from '@/features/schemaForm';

import type { ClockFieldKeysOfGraphic } from './clockFieldsOfGraphic';

const millisecondsPerSecond = 1000;

/** Reads a value of the data on air, or undefined when the data has no such key of its own. */
function readValueOnAir(dataOnAir: Record<string, unknown>, fieldKey: string): unknown {
  return Object.hasOwn(dataOnAir, fieldKey) ? dataOnAir[fieldKey] : undefined;
}

/**
 * Reads the four clock values of the data on air as one reading. Undefined when one is
 * missing or is not what a clock holds: an instance's data is "any object" to the page,
 * and it may have gone on air under an older manifest. The server's rule reads the data
 * the same way and then adds nothing either.
 */
export function readClockReadingOnAir(
  clockFieldKeys: ClockFieldKeysOfGraphic,
  dataOnAir: Record<string, unknown>,
): ClockReading | undefined {
  const timeMs = readValueOnAir(dataOnAir, clockFieldKeys.timeFieldKey);
  const referenceMomentMs = readValueOnAir(dataOnAir, clockFieldKeys.referenceMomentFieldKey);
  const running = readValueOnAir(dataOnAir, clockFieldKeys.runningFieldKey);
  const clockMode = readValueOnAir(dataOnAir, clockFieldKeys.clockModeFieldKey);

  const isTimeANumber = typeof timeMs === 'number' && Number.isFinite(timeMs);
  const isReferenceMomentANumber =
    typeof referenceMomentMs === 'number' && Number.isFinite(referenceMomentMs);
  if (!isTimeANumber || !isReferenceMomentANumber) {
    return undefined;
  }
  if (typeof running !== 'boolean') {
    return undefined;
  }
  if (clockMode !== 'elapsed' && clockMode !== 'remaining') {
    return undefined;
  }
  // The names on the left are the shared ClockReading's own (packages/shared/src/clock),
  // which the sum takes. They are not keys of any graphic's data: those came in above,
  // through `clockFieldKeys`. noGraphicSpecificCode.test.ts allows the second name in
  // this file alone, and says why.
  return { clockMode, referenceTimeMs: timeMs, referenceWallClockMs: referenceMomentMs, running };
}

/**
 * Writes the time a clock with this reading shows on screen at `nowMs`, as mm:ss: the
 * same whole second the graphic shows (a part of a second is rounded down when counting
 * up and up when counting down), and 0:00 for a countdown that ran out.
 * What could go wrong: the reading's moment is the server's clock, so `nowMs` must be
 * on the server's clock too (the caller passes the shared server-aligned "now"). Handed
 * this machine's own clock, the text is off by whatever the two clocks disagree.
 */
export function writeTimeOnScreenOfClock(reading: ClockReading, nowMs: number): string {
  const timeOnScreenMs = Math.max(0, computeClockTimeMsAtWallClock(reading, nowMs));
  const wholeSecondsOnScreen = countWholeSecondsClockShows(timeOnScreenMs, reading.clockMode);
  return formatMillisecondsAsMinutesAndSeconds(wholeSecondsOnScreen * millisecondsPerSecond);
}
