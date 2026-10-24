/**
 * The words and numbers of one standings row, as the design pages write them
 * (docs/design/tools/buildSampleData.mjs, `writePoints`): a score rounded to two decimals
 * with the zeros after the comma dropped ("921,8", "312,5", "150"), the decimal comma, and
 * the typographic minus for a negative part ("−15"), never the hyphen, which Bebas Neue
 * draws short and high. No thousands separator: the design has none, and no score of the
 * competition reaches 1000. A value the source does not know is "—", never a 0.
 */
import { ptBR } from './ptBR.js';
import type { StandingsEntry } from './standingsModel.js';

/** Writes a score the way the board shows it: 903.48 → "903,48", -15 → "−15", 150 → "150". */
export function writePointsAsText(points: number): string {
  const roundedToTwoDecimals = Math.round(points * 100) / 100;
  // String() drops the zeros after the point (312.50 is "312.5") and gives "0" for -0,
  // which the rounding of a tiny negative leaves.
  const pointWritten = String(roundedToTwoDecimals);
  const commaWritten = pointWritten.replace('.', ptBR.decimalSeparator);
  if (roundedToTwoDecimals < 0) {
    return commaWritten.replace('-', ptBR.minusSign);
  }
  return commaWritten;
}

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
