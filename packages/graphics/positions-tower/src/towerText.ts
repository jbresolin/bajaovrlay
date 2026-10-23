/**
 * The words in the tower's cells, from the entries' numbers. Gaps and intervals carry
 * no unit (João's gate decision on PR #19: the caps face has no lowercase "s"; the
 * column caption says what the number is), the cut-to-the-tenth rule is the shared one,
 * and a value the source does not know is the empty mark, never a 0 or a blank.
 */
// Only the `/raceTimeText` entry is imported: it carries no Zod and nothing else of shared.
import {
  writeLapTimeAsText,
  writeSecondsToTheTenthCutAsText,
} from '@bajaovrlay/shared/raceTimeText';

import { ptBR } from './ptBR.js';

/** The two ways a gap to the leader comes: in ms on the leader's lap, in laps when lapped. */
type GapFields = { gapToLeaderMs?: number; gapToLeaderLaps?: number };

/**
 * The DIF. cell: "+19,0" in seconds, "+1 volta" / "+2 voltas" in laps, the empty mark
 * when the source gives neither. The leader's cell is blank: there is no gap to oneself
 * (the design pages draw it empty, not with the mark).
 */
export function writeGapText(entry: GapFields, isLeader: boolean): string {
  if (isLeader) {
    return '';
  }
  if (entry.gapToLeaderMs !== undefined) {
    return ptBR.gapInSeconds(writeSecondsToTheTenthCutAsText(entry.gapToLeaderMs));
  }
  if (entry.gapToLeaderLaps !== undefined) {
    return ptBR.gapInLaps(entry.gapToLeaderLaps);
  }
  return ptBR.emptyMark;
}

/** The INTERV. cell: "+41,3", the empty mark when unknown, blank for the leader. */
export function writeIntervalText(intervalMs: number | undefined, isLeader: boolean): string {
  if (isLeader) {
    return '';
  }
  if (intervalMs === undefined) {
    return ptBR.emptyMark;
  }
  return ptBR.gapInSeconds(writeSecondsToTheTenthCutAsText(intervalMs));
}

/** A lap-time cell (ÚLT. VOLTA, MELHOR): "4:38,2", or the empty mark when unknown. */
export function writeLapTimeText(lapTimeMs: number | undefined): string {
  if (lapTimeMs === undefined) {
    return ptBR.emptyMark;
  }
  return writeLapTimeAsText(lapTimeMs);
}

/** A count cell (PARADAS, ABAST.): the number, 0 included, or the empty mark when unknown. */
export function writeCountText(count: number | undefined): string {
  if (count === undefined) {
    return ptBR.emptyMark;
  }
  return String(count);
}
