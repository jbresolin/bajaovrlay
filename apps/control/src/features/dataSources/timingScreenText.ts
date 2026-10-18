import type { PositionEntry } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const millisecondsPerSecond = 1_000;
const millisecondsPerTenthOfASecond = 100;
const tenthsPerSecond = 10;
const secondsPerMinute = 60;

/**
 * Writes a lap time the way a timing screen does: minutes, seconds and milliseconds,
 * "4:38.293". An enduro lap is 4 to 7 minutes, so the minutes never need an hour.
 */
export function formatLapTime(lapTimeMs: number): string {
  const totalSeconds = Math.floor(lapTimeMs / millisecondsPerSecond);
  const milliseconds = lapTimeMs % millisecondsPerSecond;
  const minutes = Math.floor(totalSeconds / secondsPerMinute);
  const seconds = totalSeconds % secondsPerMinute;

  const twoDigitSeconds = String(seconds).padStart(2, '0');
  const threeDigitMilliseconds = String(milliseconds).padStart(3, '0');
  return `${minutes}:${twoDigitSeconds}.${threeDigitMilliseconds}`;
}

/**
 * Writes a car's gap to the leader: "+12,3 s" on the leader's lap (seconds to the tenth
 * with a decimal comma, past a minute too, as timing screens do), "+1 volta" / "+2 voltas"
 * when lapped, and nothing for the leader or when the source does not know.
 */
export function formatGapToLeader(
  gap: Pick<PositionEntry, 'gapToLeaderMs' | 'gapToLeaderLaps'>,
): string {
  const texts = ptBR.dataSources.positionsTable;
  if (gap.gapToLeaderLaps !== undefined) {
    return texts.gapInLaps(gap.gapToLeaderLaps);
  }
  if (gap.gapToLeaderMs !== undefined) {
    return texts.gapInSeconds(writeSecondsToTheTenthCut(gap.gapToLeaderMs));
  }
  return '';
}

/**
 * Writes whole ms as seconds to the tenth with a decimal comma, cutting the rest: 12 399 ms
 * reads "12,3", not "12,4". Baja's timing records line passes with limited accuracy, so
 * the ms of a gap are false precision, and timing screens cut rather than round. Whole-number
 * steps instead of toLocaleString, whose rounding would turn 12 399 into "12,4".
 */
function writeSecondsToTheTenthCut(durationMs: number): string {
  const wholeTenths = Math.floor(durationMs / millisecondsPerTenthOfASecond);
  const wholeSeconds = Math.floor(wholeTenths / tenthsPerSecond);
  const tenthDigit = wholeTenths % tenthsPerSecond;
  return `${wholeSeconds},${tenthDigit}`;
}
