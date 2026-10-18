import type { PositionEntry } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const millisecondsPerSecond = 1_000;
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
 * Writes a car's gap to the leader: "+12,345 s" on the leader's lap (seconds with a
 * decimal comma, past a minute too, as timing screens do), "+1 volta" / "+2 voltas" when
 * lapped, and nothing for the leader or when the source does not know.
 */
export function formatGapToLeader(
  gap: Pick<PositionEntry, 'gapToLeaderMs' | 'gapToLeaderLaps'>,
): string {
  const texts = ptBR.dataSources.positionsTable;
  if (gap.gapToLeaderLaps !== undefined) {
    return texts.gapInLaps(gap.gapToLeaderLaps);
  }
  if (gap.gapToLeaderMs !== undefined) {
    const secondsWithDecimalComma = (gap.gapToLeaderMs / millisecondsPerSecond).toLocaleString(
      'pt-BR',
      { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: false },
    );
    return texts.gapInSeconds(secondsWithDecimalComma);
  }
  return '';
}
