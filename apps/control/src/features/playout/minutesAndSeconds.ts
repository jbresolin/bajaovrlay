/**
 * Reading a time typed as mm:ss, the way the operator types the race clock's reference
 * time, and writing one back the same way. Its own file so the take form's rules do not
 * also carry time arithmetic.
 */

// Minutes may have up to three digits so the four-hour endurance race fits (240:00).
// Seconds always have two digits, from 00 to 59. There is no hours part.
const minutesAndSecondsPattern = /^(\d{1,3}):([0-5]\d)$/;
const millisecondsPerSecond = 1_000;
const secondsPerMinute = 60;

/**
 * Converts text typed as mm:ss ("12:34") into milliseconds. Returns undefined when the
 * text is not in that shape, which is how the form knows to show its format message.
 */
export function convertMinutesAndSecondsToMilliseconds(text: string): number | undefined {
  const match = minutesAndSecondsPattern.exec(text.trim());
  if (match === null) {
    return undefined;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return (minutes * secondsPerMinute + seconds) * millisecondsPerSecond;
}

/**
 * Writes milliseconds as mm:ss ("12:34"), the shape the function above reads. A part of
 * a second is dropped. Minutes are never turned into hours, so four hours read "240:00";
 * past 999:59 the text has four minute digits, which the form's rule refuses.
 */
export function formatMillisecondsAsMinutesAndSeconds(milliseconds: number): string {
  const wholeSeconds = Math.floor(milliseconds / millisecondsPerSecond);
  const minutes = Math.floor(wholeSeconds / secondsPerMinute);
  const secondsPastTheMinute = wholeSeconds % secondsPerMinute;
  const twoDigitSeconds = String(secondsPastTheMinute).padStart(2, '0');
  return `${minutes}:${twoDigitSeconds}`;
}
