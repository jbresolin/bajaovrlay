import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  giveTransformedValue,
  refuseTransformValue,
  type Transform,
  type TransformResult,
} from './transform.js';

const msPerSecond = 1000;
const msPerMinute = 60_000;

/**
 * An ISO 8601 moment with its zone: "2027-08-14T14:30:00-03:00", "2027-08-14T17:30:00Z",
 * "2027-08-14T14:30:00.250-03:00". The groups are year, month, day, hour, minute, second,
 * fraction, and then either "Z" or the offset's sign, hours and minutes.
 * Seconds are required, and the offset is written with a colon; other ISO spellings
 * ("14:30Z", "-0300") are refused rather than half-supported.
 */
const isoMomentWithZonePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:(Z)|([+-])(\d{2}):(\d{2}))$/;

/** The same moment with no zone at all, told apart to give the operator the right reason. */
const isoMomentWithoutZonePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/** The parts of one ISO moment, as numbers, before any arithmetic. */
type IsoMomentParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  fractionMs: number;
  offsetMinutes: number;
};

/** Reads the matched groups into numbers. The offset is east of UTC: -03:00 is -180. */
function readIsoMomentParts(match: RegExpExecArray): IsoMomentParts {
  // Only the first three fraction digits count: the canonical shapes hold whole ms, so
  // "…00.2509" is 250 ms, as JavaScript's own Date reads it.
  const fractionDigits = (match[7] ?? '').slice(0, 3).padEnd(3, '0');
  const isUtc = match[8] === 'Z';
  const offsetSign = match[9] === '-' ? -1 : 1;
  const offsetHours = Number(match[10] ?? '0');
  const offsetMinutesPart = Number(match[11] ?? '0');
  const offsetMinutes = isUtc ? 0 : offsetSign * (offsetHours * 60 + offsetMinutesPart);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    fractionMs: Number(fractionDigits),
    offsetMinutes,
  };
}

/**
 * Answers whether the parts name a moment that exists. Date.UTC quietly rolls
 * "2027-02-30" over into March 2nd, so the date it builds is read back and compared.
 */
function isMomentInCalendar(parts: IsoMomentParts, utcMsBeforeOffset: number): boolean {
  const builtDate = new Date(utcMsBeforeOffset);
  const isDateTheSame =
    builtDate.getUTCFullYear() === parts.year &&
    builtDate.getUTCMonth() + 1 === parts.month &&
    builtDate.getUTCDate() === parts.day;
  const isTimeOfDayValid = parts.hour <= 23 && parts.minute <= 59 && parts.second <= 59;
  const isOffsetValid = Math.abs(parts.offsetMinutes) <= 23 * 60 + 59;
  return isDateTheSame && isTimeOfDayValid && isOffsetValid;
}

/**
 * Reads an ISO 8601 moment with a zone into ms since 1970. A moment with no zone is
 * refused, never read in the server's zone: guessing is how a clock ends up three hours
 * off when the server runs in UTC and the source writes Brasília time.
 */
function readIsoMomentTextAsMs(value: unknown): TransformResult {
  const quotedValue = quoteValueForReason(value);
  if (typeof value !== 'string') {
    return refuseTransformValue(ptBRTransforms.reasons.notText(quotedValue));
  }

  const trimmedText = value.trim();
  if (isoMomentWithoutZonePattern.test(trimmedText)) {
    return refuseTransformValue(ptBRTransforms.reasons.isoMomentWithoutZone(quotedValue));
  }
  const match = isoMomentWithZonePattern.exec(trimmedText);
  if (match === null) {
    return refuseTransformValue(ptBRTransforms.reasons.notAnIsoMoment(quotedValue));
  }

  const parts = readIsoMomentParts(match);
  const utcMsBeforeOffset = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  if (!isMomentInCalendar(parts, utcMsBeforeOffset)) {
    return refuseTransformValue(ptBRTransforms.reasons.momentNotInCalendar(quotedValue));
  }

  // 14:30 at -03:00 is 17:30 UTC, so the offset is taken away.
  const msSince1970 = utcMsBeforeOffset - parts.offsetMinutes * msPerMinute + parts.fractionMs;
  return giveTransformedValue(msSince1970);
}

/**
 * Converts seconds since 1970 (Unix time) to ms, rounded to the nearest one, so a
 * fractional 1818264600.5 becomes 1818264600500. A number only, as JSON APIs send Unix
 * time; one written as text is refused, since a rule has one transform and no chain.
 */
function convertUnixSecondsToMs(value: unknown): TransformResult {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return refuseTransformValue(ptBRTransforms.reasons.notANumber(quoteValueForReason(value)));
  }
  return giveTransformedValue(Math.round(value * msPerSecond));
}

/** "2027-08-14T14:30:00-03:00" becomes ms since 1970; a moment with no zone is refused. */
export const isoDateTextToMsTransform: Transform = {
  id: 'isoDateTextToMs',
  label: ptBRTransforms.transforms.isoDateTextToMs.label,
  description: ptBRTransforms.transforms.isoDateTextToMs.description,
  apply: (value) => readIsoMomentTextAsMs(value),
};

/** 1818264600 (seconds since 1970) becomes 1818264600000 ms. */
export const unixSecondsToMsTransform: Transform = {
  id: 'unixSecondsToMs',
  label: ptBRTransforms.transforms.unixSecondsToMs.label,
  description: ptBRTransforms.transforms.unixSecondsToMs.description,
  apply: (value) => convertUnixSecondsToMs(value),
};
