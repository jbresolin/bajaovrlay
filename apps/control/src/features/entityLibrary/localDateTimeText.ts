/**
 * Moments of the schedule as the operator types and reads them: a date and a time of day
 * on this computer's clock, never a time zone to choose (the stream runs where the
 * computer is). What could go wrong: a CSV written on a computer set to another time zone
 * reads as other hours here; the page says so beside the columns.
 */

/** A date and time as typed: "14/11/2026 10:00" (pt-BR) or "2026-11-14 10:00" (ISO). */
const brazilianDateTime = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})$/;
const isoDateTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

/** Two digits: 7 as "07". */
function writeTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** The parts of a date and time as typed, month counted from 1. */
type DateTimeParts = { year: number; month: number; day: number; hours: number; minutes: number };

/** The parts of a typed date and time in either accepted form, or undefined. */
function readDateTimeParts(text: string): DateTimeParts | undefined {
  const brazilianMatch = brazilianDateTime.exec(text);
  if (brazilianMatch !== null) {
    return {
      day: Number(brazilianMatch[1]),
      month: Number(brazilianMatch[2]),
      year: Number(brazilianMatch[3]),
      hours: Number(brazilianMatch[4]),
      minutes: Number(brazilianMatch[5]),
    };
  }
  const isoMatch = isoDateTime.exec(text);
  if (isoMatch !== null) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
      hours: Number(isoMatch[4]),
      minutes: Number(isoMatch[5]),
    };
  }
  return undefined;
}

/**
 * The moment of a date and time typed on this computer's clock, in ms since 1970, or
 * undefined for a text that is not one ("sábado cedo", "31/02/2026 10:00").
 */
export function readLocalDateTimeText(text: string): number | undefined {
  const parts = readDateTimeParts(text.trim());
  if (parts === undefined) {
    return undefined;
  }
  const moment = new Date(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes);
  // Date rolls 31/02 over into March; a date that does not come back as typed is not one.
  const isTheDateAsTyped =
    moment.getFullYear() === parts.year &&
    moment.getMonth() === parts.month - 1 &&
    moment.getDate() === parts.day &&
    moment.getHours() === parts.hours &&
    moment.getMinutes() === parts.minutes;
  return isTheDateAsTyped ? moment.getTime() : undefined;
}

/** A moment as the CSV and the table write it: "14/11/2026 10:00" on this computer's clock. */
export function writeLocalDateTimeText(momentMs: number): string {
  const moment = new Date(momentMs);
  const date = `${writeTwoDigits(moment.getDate())}/${writeTwoDigits(moment.getMonth() + 1)}/${String(moment.getFullYear())}`;
  return `${date} ${writeTwoDigits(moment.getHours())}:${writeTwoDigits(moment.getMinutes())}`;
}

/** A moment as a datetime-local input holds it: "2026-11-14T10:00". */
export function writeDateTimeInputValue(momentMs: number): string {
  const moment = new Date(momentMs);
  const date = `${String(moment.getFullYear())}-${writeTwoDigits(moment.getMonth() + 1)}-${writeTwoDigits(moment.getDate())}`;
  return `${date}T${writeTwoDigits(moment.getHours())}:${writeTwoDigits(moment.getMinutes())}`;
}
