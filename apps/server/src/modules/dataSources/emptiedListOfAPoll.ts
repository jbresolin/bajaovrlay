// Finding a list of cars that a poll emptied: the one valid answer that would still blank
// a graphic on air (BAJAOVRLAY-32).
import type { DataSnapshotShapes } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/**
 * Why a poll's shapes must not replace the stored ones, or null when they may. A
 * positions or standings list that had entries and now has none is suspect: a timing
 * system restarting, or a Baja app between two refreshes, answers that way, and storing it
 * would take every row off a tower or a standings board on air. The first data a source
 * ever sends may be empty (a race before its green flag), and so may a list that was
 * already empty: there is nothing on air to blank then. Fewer entries is real data
 * (cars retire); only none at all is refused. Incidents and Super Chats are left out: they
 * are empty most of the race by nature, and no graphic shows them as a table.
 */
export function findWhyThePollEmptiedAList(
  storedShapes: DataSnapshotShapes | undefined,
  polledShapes: DataSnapshotShapes,
): string | null {
  const storedPositionsCount = storedShapes?.positions?.entries.length ?? 0;
  const polledPositionsCount = polledShapes.positions?.entries.length;
  if (storedPositionsCount > 0 && polledPositionsCount === 0) {
    return ptBR.dataSourceErrors.positionsListCameEmpty;
  }
  const storedStandingsCount = storedShapes?.standings?.entries.length ?? 0;
  const polledStandingsCount = polledShapes.standings?.entries.length;
  if (storedStandingsCount > 0 && polledStandingsCount === 0) {
    return ptBR.dataSourceErrors.standingsListCameEmpty;
  }
  return null;
}
