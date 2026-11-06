import type { Graphic, Item, ProgramHistory, ProgramHistoryEntry } from '@bajaovrlay/shared';

import { replaceEntriesOfLayer } from './rememberProgramChanges.js';

/**
 * The programHistory without the entries that can never come back: those naming an item
 * that no longer exists, or one whose graphic is no longer listed. Run by reduceCommand
 * when a command changed the items or the graphics (a deleteItem), and at boot, when the
 * graphics are found again on disk (gate 2 of PR #44).
 * Why: such an entry is refused on every press and never forgotten, so "Desfazer" on its
 * layer would be dead, and "Desfazer última" and Ctrl+Z refused everywhere until some other
 * change. Dropping it makes the undo go one change further back, as the brief asks; the
 * changes around it stay in their order. Hands back the very same array when nothing went,
 * so the store neither saves nor broadcasts it.
 */
export function forgetChangesThatCannotComeBack(
  programHistory: ProgramHistory,
  items: Item[],
  graphics: Graphic[],
): ProgramHistory {
  let historyKept = programHistory;
  for (const layerHistory of programHistory) {
    const entriesKept = layerHistory.entries.filter((entry) =>
      canEntryComeBack(entry, items, graphics),
    );
    if (entriesKept.length !== layerHistory.entries.length) {
      historyKept = replaceEntriesOfLayer(historyKept, layerHistory.layerId, entriesKept);
    }
  }
  return historyKept;
}

/**
 * Whether an undo could put this entry back: "vazio" always can; an item only while it
 * exists and its graphic is listed, which are the two checks putBackWhatLayerShowed makes.
 */
function canEntryComeBack(entry: ProgramHistoryEntry, items: Item[], graphics: Graphic[]): boolean {
  const shownBefore = entry.shownBefore;
  if (shownBefore.kind === 'empty') {
    return true;
  }
  const item = items.find((candidate) => candidate.id === shownBefore.itemId);
  if (item === undefined) {
    return false;
  }
  return graphics.some((graphic) => graphic.id === item.graphicId);
}
