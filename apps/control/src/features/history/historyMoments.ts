/**
 * The moment of a history row on the operator's clock: "14:32:05" for a row of today, and
 * "09/10 14:32:05" for an older one (the log keeps every day of the event, and "Carregar
 * mais" reaches back into them). What could go wrong: a page on a machine set to another
 * time zone shows other hours, as everywhere on the page (timeOfDayText.ts).
 */
export function formatMomentOfHistoryRow(momentMs: number, nowMs: number): string {
  const moment = new Date(momentMs);
  const timeOfDay = moment.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const isToday = moment.toDateString() === new Date(nowMs).toDateString();
  if (isToday) {
    return timeOfDay;
  }
  const dayAndMonth = moment.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${dayAndMonth} ${timeOfDay}`;
}
