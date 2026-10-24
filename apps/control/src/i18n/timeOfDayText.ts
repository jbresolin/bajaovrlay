/**
 * Moments written for the operator, on the clock of the operator's computer: the time of
 * day of a source's last good data ("15:44:00") and the date and time a recording began
 * ("19/03/2027, 10:00"). What could go wrong: a page opened on a machine set to another
 * time zone shows other hours for the same moment.
 */

/** Writes a moment as hh:mm:ss in the operator's local time. */
export function formatTimeOfDay(momentMs: number): string {
  return new Date(momentMs).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Writes a moment as a short date and hh:mm in the operator's local time. */
export function formatDateAndTimeOfDay(momentMs: number): string {
  return new Date(momentMs).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
