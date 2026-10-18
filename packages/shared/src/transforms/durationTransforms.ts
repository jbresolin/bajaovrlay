import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  giveTransformedValue,
  refuseTransformValue,
  type Transform,
  type TransformResult,
} from './transform.js';

const msPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;

/**
 * The seconds part of a lap time: digits, then optionally a comma or point and one to
 * three digits of fraction ("38.293", "38,2", "278"). More than three fraction digits is
 * refused: no timing system we know sends below the millisecond, so a longer fraction
 * probably means the wrong field.
 */
const secondsPartPattern = /^(\d+)(?:[.,](\d{1,3}))?$/;

/** The minutes or hours part of a lap time: digits only. */
const wholeNumberPartPattern = /^\d+$/;

/**
 * Converts a number of seconds to whole milliseconds, rounded to the nearest one:
 * 278.293 becomes 278 293. Rounding, not truncating, because 278.293 × 1000 is
 * 278 292.999… in floating point.
 */
function convertSecondsToMs(value: unknown): TransformResult {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return refuseTransformValue(ptBRTransforms.reasons.notANumber(quoteValueForReason(value)));
  }
  return giveTransformedValue(Math.round(value * msPerSecond));
}

/**
 * Turns the fraction digits after the separator into milliseconds: "293" is 293,
 * "4" is 400, "05" is 50, and no fraction at all is 0.
 */
function convertFractionDigitsToMs(fractionDigits: string | undefined): number {
  if (fractionDigits === undefined) {
    return 0;
  }
  const digitsPaddedToMs = fractionDigits.padEnd(3, '0');
  return Number(digitsPaddedToMs);
}

/**
 * Reads a lap time written as text into milliseconds. Accepted, with a comma or a point
 * before the fraction: "278.293" (seconds), "4:38.293" (minutes and seconds) and
 * "1:02:03.4" (hours, minutes and seconds). Once minutes are written, the seconds must
 * be two digits under 60, and once hours are, so must the minutes: "4:75.000" is refused
 * rather than read as 5:15.
 */
function readLapTimeTextAsMs(value: unknown): TransformResult {
  const quotedValue = quoteValueForReason(value);
  if (typeof value !== 'string') {
    return refuseTransformValue(ptBRTransforms.reasons.notText(quotedValue));
  }
  const refusal = refuseTransformValue(ptBRTransforms.reasons.notALapTime(quotedValue));

  // Split "1:02:03.4" into ["1", "02", "03.4"]: hours, minutes, seconds from the left,
  // with the seconds always last.
  const parts = value.trim().split(':');
  if (parts.length > 3) {
    return refusal;
  }
  const secondsPart = parts[parts.length - 1] ?? '';
  const minutesPart = parts.length >= 2 ? parts[parts.length - 2] : undefined;
  const hoursPart = parts.length === 3 ? parts[0] : undefined;

  // The seconds and their fraction.
  const secondsMatch = secondsPartPattern.exec(secondsPart);
  if (secondsMatch === null) {
    return refusal;
  }
  const secondsDigits = secondsMatch[1] ?? '';
  const seconds = Number(secondsDigits);
  const fractionMs = convertFractionDigitsToMs(secondsMatch[2]);
  const hasMinutes = minutesPart !== undefined;
  const areSecondsWrittenAsClock = secondsDigits.length === 2 && seconds < secondsPerMinute;
  if (hasMinutes && !areSecondsWrittenAsClock) {
    return refusal;
  }

  // The minutes, when there are any.
  let minutes = 0;
  if (minutesPart !== undefined) {
    if (!wholeNumberPartPattern.test(minutesPart)) {
      return refusal;
    }
    minutes = Number(minutesPart);
  }
  const hasHours = hoursPart !== undefined;
  const areMinutesWrittenAsClock = minutesPart?.length === 2 && minutes < minutesPerHour;
  if (hasHours && !areMinutesWrittenAsClock) {
    return refusal;
  }

  // The hours, when there are any.
  let hours = 0;
  if (hoursPart !== undefined) {
    if (!wholeNumberPartPattern.test(hoursPart)) {
      return refusal;
    }
    hours = Number(hoursPart);
  }

  const totalWholeSeconds = (hours * minutesPerHour + minutes) * secondsPerMinute + seconds;
  return giveTransformedValue(totalWholeSeconds * msPerSecond + fractionMs);
}

/** 278.293 (seconds, a number) becomes 278 293 ms. */
export const secondsToMsTransform: Transform = {
  id: 'secondsToMs',
  label: ptBRTransforms.transforms.secondsToMs.label,
  description: ptBRTransforms.transforms.secondsToMs.description,
  apply: (value) => convertSecondsToMs(value),
};

/** "4:38.293", "4:38,293", "278.293" and "1:02:03.4" become milliseconds. */
export const lapTimeTextToMsTransform: Transform = {
  id: 'lapTimeTextToMs',
  label: ptBRTransforms.transforms.lapTimeTextToMs.label,
  description: ptBRTransforms.transforms.lapTimeTextToMs.description,
  apply: (value) => readLapTimeTextAsMs(value),
};
