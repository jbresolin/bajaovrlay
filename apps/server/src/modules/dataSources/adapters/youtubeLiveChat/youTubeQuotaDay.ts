// The day YouTube's quota counts by: Google resets every key's daily units at midnight,
// Pacific time (America/Los_Angeles), which is 5h in Brasília in the northern winter and
// 4h in the northern summer. Worked out with the time-zone database (Intl), never with a
// fixed offset, so the change of US daylight time is followed by itself.

/** The quota day's own time zone, as Google documents it. */
const pacificTimeZone = 'America/Los_Angeles';

/** Where the operator reads the time of the reset. */
const brasiliaTimeZone = 'America/Sao_Paulo';

/** A calendar day and an hour on a time zone's clock. */
type ClockReading = { year: number; month: number; day: number; hour: number; minute: number };

/** Reads the calendar and the clock of a time zone at one moment. */
function readClockInTimeZone(momentMs: number, timeZone: string): ClockReading {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(momentMs));
  const readPart = (partType: string): number =>
    Number(parts.find((part) => part.type === partType)?.value ?? '0');
  return {
    year: readPart('year'),
    month: readPart('month'),
    day: readPart('day'),
    hour: readPart('hour'),
    minute: readPart('minute'),
  };
}

/** The quota day of a moment, as "2026-11-08" on the Pacific calendar. */
export function readPacificQuotaDay(momentMs: number): string {
  const pacific = readClockInTimeZone(momentMs, pacificTimeZone);
  const monthText = String(pacific.month).padStart(2, '0');
  const dayText = String(pacific.day).padStart(2, '0');
  return `${String(pacific.year)}-${monthText}-${dayText}`;
}

/**
 * The moment the next quota day starts: the next midnight on the Pacific clock. Pacific
 * time is 7 or 8 hours behind UTC, so the next day's midnight is 07:00 or 08:00 UTC of
 * that day; the one of the two the Pacific clock reads as 00:00 is the answer.
 */
export function findNextPacificMidnightMs(momentMs: number): number {
  const pacific = readClockInTimeZone(momentMs, pacificTimeZone);
  // Date.UTC rolls a day 32 over into the next month by itself.
  const hoursBehindUtcToTry = [7, 8];
  for (const hoursBehindUtc of hoursBehindUtcToTry) {
    const candidateMs = Date.UTC(pacific.year, pacific.month - 1, pacific.day + 1, hoursBehindUtc);
    const candidateOnThePacificClock = readClockInTimeZone(candidateMs, pacificTimeZone);
    const isMidnight =
      candidateOnThePacificClock.hour === 0 && candidateOnThePacificClock.minute === 0;
    if (isMidnight) {
      return candidateMs;
    }
  }
  // Unreachable while Pacific time is UTC−7 or UTC−8; a day later is the safe side.
  return momentMs + 24 * 60 * 60 * 1_000;
}

/** The hour on Brasília's clock when the next quota day starts: 5 in winter, 4 in summer. */
export function readBrasiliaHourOfTheNextQuotaDay(momentMs: number): number {
  const nextPacificMidnightMs = findNextPacificMidnightMs(momentMs);
  return readClockInTimeZone(nextPacificMidnightMs, brasiliaTimeZone).hour;
}
