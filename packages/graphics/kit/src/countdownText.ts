/**
 * The countdown's text (BAJAOVRLAY-46), for the countdown card, the waiting screen and
 * the intermission's next-session card: the time left until a session's start,
 * `startsAtMs`, an absolute moment, written as the race clock writes a countdown (shared's
 * formatter: `m:ss` below an hour, `h:mm:ss` from an hour up, a partial second rounded up,
 * never negative); and the time of day of a start ("10:00"), which the sessions board
 * writes for its slots too.
 *
 * Pass the server-aligned "now" (`readServerAlignedTimeMs`), never `Date.now()`: the
 * start was typed on the control page against the server's clock, and the OBS machine's
 * may differ from it.
 */
import { formatClockTimeAsHoursMinutesSeconds } from '@bajaovrlay/shared/clock';

/** The count at `nowMs`: "23:45", "1:00:00", and "0:00" from the start on. */
export function writeCountdownTextAt(startsAtMs: number, nowMs: number): string {
  const timeLeftMs = startsAtMs - nowMs;
  return formatClockTimeAsHoursMinutesSeconds(timeLeftMs, 'remaining');
}

/** Whether the count is over at `nowMs`: from the start's very millisecond on. */
export function hasCountdownReachedZeroAt(startsAtMs: number, nowMs: number): boolean {
  return nowMs >= startsAtMs;
}

/**
 * The time of day of a moment, hours and minutes in 24-hour time with two digits each
 * ("07:30", "16:00"). Left without `timeZone`, as on air, it is the machine's clock, which
 * is the clock Cadastros typed the schedule in (the control page reads "this computer's
 * clock"); tests pass Brasília's so they do not depend on the machine.
 */
export function writeTimeOfDayText(momentMs: number, timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  return formatter.format(momentMs);
}
