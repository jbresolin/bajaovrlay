/**
 * The words and numbers of one standings row, as the design pages write them: each score by
 * the kit's writePointsAsText ("921,8", "−15"; shared with the intermission's top five), a
 * value the source does not know as "—", never a 0, and a disqualified team's "—" and
 * "DESCL.".
 */
import { writePointsAsText } from '@bajaovrlay/graphics-kit/pointsText';

import { ptBR } from './ptBR.js';
import type { StandingsEntry } from './standingsModel.js';

/** The rank cell: the rank, or "—" for a disqualified team (which has none). */
export function writeRankText(entry: StandingsEntry): string {
  const isDisqualified = entry.isDisqualified ?? false;
  if (isDisqualified || entry.rank === undefined) {
    return ptBR.emptyMark;
  }
  return String(entry.rank);
}

/** The total cell: the points, or "DESCL." for a disqualified team. */
export function writeTotalText(entry: StandingsEntry): string {
  const isDisqualified = entry.isDisqualified ?? false;
  if (isDisqualified) {
    return ptBR.disqualifiedTotal;
  }
  return writePointsAsText(entry.points);
}

/** One part's cell: its points, or "—" when the source left that part out for this team. */
export function writePartPointsText(entry: StandingsEntry, partId: string): string {
  const partPoints = entry.pointsByPart?.[partId];
  if (partPoints === undefined) {
    return ptBR.emptyMark;
  }
  return writePointsAsText(partPoints);
}

/**
 * Whether the row's rank sits on the green chip: rank 1, tied or not, and never a
 * disqualified team.
 */
export function isOnTheLeaderChip(entry: StandingsEntry): boolean {
  const isDisqualified = entry.isDisqualified ?? false;
  return !isDisqualified && entry.rank === 1;
}
