/**
 * A car's time in a timed match as the Super Prime's scoring sheet writes it: seconds with
 * a comma and three decimals ("41,870"), minutes before them past a minute ("1:03,215").
 * The match bug's and the "a seguir" card's (BAJAOVRLAY-65); kept in the kit rather than
 * shared, since the graphics import nothing zod-bearing from @bajaovrlay/shared.
 */

/** Writes a time in milliseconds as "41,870" or "1:03,215"; never negative. */
export function writeMatchTimeText(timeMs: number): string {
  const wholeMilliseconds = Math.max(0, Math.round(timeMs));
  const minutes = Math.floor(wholeMilliseconds / 60_000);
  const millisecondsInTheMinute = wholeMilliseconds - minutes * 60_000;
  const seconds = Math.floor(millisecondsInTheMinute / 1000);
  const thousandths = millisecondsInTheMinute - seconds * 1000;
  const thousandthsText = String(thousandths).padStart(3, '0');
  if (minutes === 0) {
    return `${String(seconds)},${thousandthsText}`;
  }
  const secondsText = String(seconds).padStart(2, '0');
  return `${String(minutes)}:${secondsText},${thousandthsText}`;
}
