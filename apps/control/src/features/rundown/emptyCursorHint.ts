import type { Rundown } from '@bajaovrlay/shared';

/**
 * What the rundown panel says while Space has nothing to take:
 * - `none`: an item is next, or the rundown has no items (the panel says that itself);
 * - `endOfRundown`: the cursor is on nothing because the last item was taken at the cursor;
 * - `placeTheCursor`: the cursor is on nothing for any other reason.
 */
export type EmptyCursorHint = 'none' | 'placeTheCursor' | 'endOfRundown';

/**
 * Chooses the hint for a rundown from its cursor, how many items it has and the mark
 * the server sets when the rundown was played to its end. The page decides nothing by
 * itself: a rundown without the mark (also one stored before the mark existed) only
 * ever asks for the cursor to be placed.
 */
export function chooseEmptyCursorHint(rundown: Rundown, numberOfItems: number): EmptyCursorHint {
  const isCursorOnAnItem = rundown.cursorItemId !== null;
  if (isCursorOnAnItem || numberOfItems === 0) {
    return 'none';
  }
  const wasPlayedToItsEnd = rundown.wasLastItemTakenAtCursor === true;
  return wasPlayedToItsEnd ? 'endOfRundown' : 'placeTheCursor';
}
