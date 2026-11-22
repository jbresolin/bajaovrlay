/**
 * Reading a number from one value of a cell, as the site writes it: "57.3", "-15", "102.5%",
 * "6º", "1:02.3" (BAJAOVRLAY-83). Shared by the cell's text (a cell of two values is cut
 * only when its first part is a number) and the sort ("Ordenar por").
 */

// "57.3", "-15", "−15" (a typographic minus): a whole or decimal number, the point as decimal.
const plainNumberPattern = /^[-−]?\d+(\.\d+)?$/;
// "1:02.3": minutes and seconds, as a lap over a minute is written.
const minutesAndSecondsPattern = /^(\d+):(\d{1,2}(\.\d+)?)$/;
// The marks after a number that do not change it: a percentage and an ordinal ("6º", "1ª").
const trailingMarksPattern = /[%ºª°]$/;

/**
 * The number one value holds, or undefined when it holds none. Drops a trailing "%" or
 * "º", and reads minutes and seconds as seconds. "SPOILERS", "–", "-" and "" hold none.
 */
export function readNumberFromValueText(valueText: string): number | undefined {
  const withoutTrailingMark = valueText.trim().replace(trailingMarksPattern, '').trim();
  if (plainNumberPattern.test(withoutTrailingMark)) {
    return Number(withoutTrailingMark.replace('−', '-'));
  }
  const minutesAndSeconds = minutesAndSecondsPattern.exec(withoutTrailingMark);
  if (minutesAndSeconds !== null) {
    const minutes = Number(minutesAndSeconds[1]);
    const seconds = Number(minutesAndSeconds[2]);
    return minutes * 60 + seconds;
  }
  return undefined;
}
