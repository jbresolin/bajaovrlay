/**
 * A moment in time, between the two ways it is written: the ISO 8601 text a graphic
 * receives ("2026-10-10T12:45:00.000Z") and the text a browser's date-and-time input
 * holds ("2026-10-10T09:45"), which is the same moment on the clock of the operator's
 * computer and names no time zone.
 *
 * What could go wrong: the operator's computer decides the time zone. A control page
 * opened on a machine set to another zone shows, and sends, the same moment with other
 * digits. Parts of a second are dropped when a moment is shown, so a value that is shown
 * and then sent again (a take of the whole form) loses its milliseconds.
 */

// The browser writes year-month-day, a "T", hours and minutes, and seconds (with or
// without a part of a second) only when they are not zero.
const localDateAndTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

// What a text must start with to be taken for an ISO 8601 date and time. Date.parse alone
// also reads texts such as "10 October 2026", which no graphic should be sent.
const isoDateAndTimeStartPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function writeWithTwoDigits(numberToWrite: number): string {
  return String(numberToWrite).padStart(2, '0');
}

/**
 * Converts the text of a date-and-time input into ISO 8601 text in UTC. Returns undefined
 * when the text is not a date and time, or names a day or hour that does not exist (the
 * 31st of April, 25 o'clock).
 */
export function convertLocalDateAndTimeTextToIsoText(localText: string): string | undefined {
  const match = localDateAndTimePattern.exec(localText.trim());
  if (match === null) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const seconds = match[6] === undefined ? 0 : Number(match[6]);

  const moment = new Date(year, month - 1, day, hours, minutes, seconds);
  // JavaScript quietly rolls an impossible date over (the 31st of April becomes the 1st
  // of May). Reading the parts back shows whether that happened.
  const isTheMomentThatWasTyped =
    moment.getFullYear() === year &&
    moment.getMonth() === month - 1 &&
    moment.getDate() === day &&
    moment.getHours() === hours &&
    moment.getMinutes() === minutes &&
    moment.getSeconds() === seconds;
  if (!isTheMomentThatWasTyped) {
    return undefined;
  }
  return moment.toISOString();
}

/**
 * Converts ISO 8601 text into the text a date-and-time input shows, on the clock of this
 * computer. Seconds are written only when they are not zero; a part of a second is
 * dropped. Returns undefined when the text is not an ISO 8601 date and time.
 */
export function convertIsoTextToLocalDateAndTimeText(isoText: string): string | undefined {
  if (!isoDateAndTimeStartPattern.test(isoText)) {
    return undefined;
  }
  const momentInMilliseconds = Date.parse(isoText);
  if (Number.isNaN(momentInMilliseconds)) {
    return undefined;
  }
  const moment = new Date(momentInMilliseconds);
  const year = String(moment.getFullYear()).padStart(4, '0');
  const month = writeWithTwoDigits(moment.getMonth() + 1);
  const day = writeWithTwoDigits(moment.getDate());
  const hours = writeWithTwoDigits(moment.getHours());
  const minutes = writeWithTwoDigits(moment.getMinutes());
  const dateAndTimeToTheMinute = `${year}-${month}-${day}T${hours}:${minutes}`;

  const seconds = moment.getSeconds();
  if (seconds === 0) {
    return dateAndTimeToTheMinute;
  }
  return `${dateAndTimeToTheMinute}:${writeWithTwoDigits(seconds)}`;
}
