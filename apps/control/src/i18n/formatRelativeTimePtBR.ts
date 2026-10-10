import { ptBR } from './ptBR';

const millisecondsPerMinute = 60_000;
const minutesPerHour = 60;
const hoursPerDay = 24;

/**
 * Says how long ago `pastMoment` was, seen from `now`, the way an operator would:
 * "agora", "há 2 min", "há 4 h", "há 3 dias". Always rounds down. This is the one
 * function on the control page that writes relative times.
 *
 * A moment in the future reads "agora": the server stamps the times and its clock can
 * be a little ahead of the operator's machine.
 */
export function formatRelativeTimePtBR(pastMoment: Date, now: Date): string {
  const elapsedMilliseconds = now.getTime() - pastMoment.getTime();
  const elapsedMinutes = Math.floor(elapsedMilliseconds / millisecondsPerMinute);
  if (elapsedMinutes < 1) {
    return ptBR.relativeTime.justNow;
  }
  if (elapsedMinutes < minutesPerHour) {
    return ptBR.relativeTime.minutesAgo(elapsedMinutes);
  }

  const elapsedHours = Math.floor(elapsedMinutes / minutesPerHour);
  if (elapsedHours < hoursPerDay) {
    return ptBR.relativeTime.hoursAgo(elapsedHours);
  }

  const elapsedDays = Math.floor(elapsedHours / hoursPerDay);
  return ptBR.relativeTime.daysAgo(elapsedDays);
}
