import { isDeepStrictEqual } from 'node:util';

import {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  countWholeSecondsClockShows,
} from '@bajaovrlay/shared';

import type { UpdateRule, UpdateRuleResult } from './updateRuleTypes.js';

// The four fields a race clock works its time out from. A graphic that names this rule
// must declare all four in its data schema.
const referenceTimeKey = 'referenceTimeMs';
const referenceMomentKey = 'referenceWallClockMs';
const runningKey = 'running';
const clockModeKey = 'clockMode';
const clockFieldKeys = [referenceTimeKey, referenceMomentKey, runningKey, clockModeKey];

const millisecondsPerSecond = 1000;

/**
 * carryClockForward: keeps a clock on air from jumping when an update stops it, starts
 * it, turns its direction or corrects its time. In those cases it also writes the time
 * the screen shows at `nowMs` (or the typed time, if one was sent) and `nowMs` as the
 * moment that time is true. A clock whose direction is turned gets the whole second on
 * screen, so the number does not move. Every other update goes through as it came.
 * What could go wrong: a typed time equal to the reference time on air does not count
 * as typed (it is not a change), so the time on screen is written instead.
 */
export function carryClockForward(
  dataOnAir: Record<string, unknown>,
  fieldsSent: Record<string, unknown>,
  keysStamped: string[],
  keysCleared: string[],
  nowMs: number,
): UpdateRuleResult {
  const fieldsExactlyAsTheyCame: UpdateRuleResult = { fieldsToWrite: fieldsSent };

  // Only a field whose value differs from the air counts as sent. A form that re-sends
  // what is on air therefore asks for nothing here, and the reducer can still see that
  // the update changes nothing.
  const keysOfFieldsThatDifferFromAir = Object.keys(fieldsSent).filter((fieldKey) =>
    doesFieldSentDifferFromAir(dataOnAir, fieldsSent, fieldKey),
  );

  // A reference moment that was stamped, or sent with a new value, is the sender saying
  // which reading it wants. The rule must not replace it with its own.
  const wasReferenceMomentStamped = keysStamped.includes(referenceMomentKey);
  const wasReferenceMomentSent = keysOfFieldsThatDifferFromAir.includes(referenceMomentKey);
  if (wasReferenceMomentStamped || wasReferenceMomentSent) {
    return fieldsExactlyAsTheyCame;
  }

  // Clearing a clock field is a mistake the graphic's schema refuses (all four are
  // required). Writing a time over a cleared field would hide the mistake.
  const wasAClockFieldCleared = clockFieldKeys.some((clockFieldKey) =>
    keysCleared.includes(clockFieldKey),
  );
  if (wasAClockFieldCleared) {
    return fieldsExactlyAsTheyCame;
  }

  const wasTheTimeTyped = keysOfFieldsThatDifferFromAir.includes(referenceTimeKey);
  const wasRunningChanged = keysOfFieldsThatDifferFromAir.includes(runningKey);
  const wasClockModeChanged = keysOfFieldsThatDifferFromAir.includes(clockModeKey);
  const wasTheClockItselfChanged = wasTheTimeTyped || wasRunningChanged || wasClockModeChanged;
  if (!wasTheClockItselfChanged) {
    return fieldsExactlyAsTheyCame;
  }

  // Deliberate trade-off: when the data on air cannot be read as a clock, nothing is
  // added. The time on screen cannot be worked out, and a guessed time on air is worse
  // than what follows: the graphic's schema judges the result as it came.
  const readingOnAir = readClockReadingOnAir(dataOnAir);
  if (readingOnAir === undefined) {
    return fieldsExactlyAsTheyCame;
  }

  // The same sum the graphic does on every frame. A countdown that ran out gives a
  // negative number; the screen shows 0:00 and the schema refuses a negative time.
  const timeOnScreenNowMs = Math.max(0, computeClockTimeMsAtWallClock(readingOnAir, nowMs));

  // A changed mode keeps the number on screen and turns only its direction. The screen
  // shows whole seconds, and the two directions round differently (elapsed down,
  // remaining up): 45:00.5 reads 45:00 counting up and 45:01 counting down. So a turned
  // clock gets the whole second the old direction was showing, not the milliseconds.
  // Deliberate trade-off: up to one second of clock time is dropped or added at a turn,
  // which is what it takes for the number on air not to move at the press. A clock that
  // is only stopped or started keeps its milliseconds: its rounding does not change.
  const wholeSecondsOnScreenNow = countWholeSecondsClockShows(
    timeOnScreenNowMs,
    readingOnAir.clockMode,
  );
  const timeToCarryForwardMs = wasClockModeChanged
    ? wholeSecondsOnScreenNow * millisecondsPerSecond
    : timeOnScreenNowMs;
  const referenceTimeToWrite = wasTheTimeTyped
    ? fieldsSent[referenceTimeKey]
    : timeToCarryForwardMs;

  return {
    fieldsToWrite: {
      ...fieldsSent,
      [referenceTimeKey]: referenceTimeToWrite,
      [referenceMomentKey]: nowMs,
    },
  };
}

/** carryClockForward as the registry lists it, with the schema properties it needs. */
export const carryClockForwardRule: UpdateRule = {
  name: 'carryClockForward',
  schemaPropertiesNeeded: clockFieldKeys,
  applyRule: carryClockForward,
};

/** Says whether a field sent holds something other than what is on air, by content. */
function doesFieldSentDifferFromAir(
  dataOnAir: Record<string, unknown>,
  fieldsSent: Record<string, unknown>,
  fieldKey: string,
): boolean {
  const isFieldOnAir = Object.hasOwn(dataOnAir, fieldKey);
  if (!isFieldOnAir) {
    return true;
  }
  return !isDeepStrictEqual(fieldsSent[fieldKey], dataOnAir[fieldKey]);
}

/**
 * Reads the four clock fields of the data on air as one clock reading. Undefined when
 * one is missing or of the wrong kind: an instance's data is stored as "any object",
 * and it may have gone on air under an older manifest.
 */
function readClockReadingOnAir(dataOnAir: Record<string, unknown>): ClockReading | undefined {
  const referenceTimeMs = dataOnAir[referenceTimeKey];
  const referenceWallClockMs = dataOnAir[referenceMomentKey];
  const running = dataOnAir[runningKey];
  const clockMode = dataOnAir[clockModeKey];

  const isReferenceTimeANumber =
    typeof referenceTimeMs === 'number' && Number.isFinite(referenceTimeMs);
  const isReferenceMomentANumber =
    typeof referenceWallClockMs === 'number' && Number.isFinite(referenceWallClockMs);
  if (!isReferenceTimeANumber || !isReferenceMomentANumber) {
    return undefined;
  }
  if (typeof running !== 'boolean') {
    return undefined;
  }
  if (clockMode !== 'elapsed' && clockMode !== 'remaining') {
    return undefined;
  }
  return { referenceTimeMs, referenceWallClockMs, running, clockMode };
}
