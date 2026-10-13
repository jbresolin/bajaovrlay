import type { Item, Rundown } from '@bajaovrlay/shared';

import { findItemThatFollows } from './itemOrdering.js';

/**
 * The rundowns after `takenItem` went on air (takeItem, takeNext or takePreview). The
 * cursor is the plan ("what Space fires next"), so it moves on only when the plan itself
 * was carried out: the item taken was the cursor item. An item fired ad hoc leaves the
 * plan alone, and the very same rundowns array comes back, so the store neither saves
 * nor broadcasts it.
 */
export function moveRundownCursorOnIfItWasOnTakenItem(
  rundowns: Rundown[],
  items: Item[],
  takenItem: Item,
): Rundown[] {
  const rundownOfTakenItem = rundowns.find((candidate) => candidate.id === takenItem.rundownId);
  const wasTakenItemTheCursorItem = rundownOfTakenItem?.cursorItemId === takenItem.id;
  if (!wasTakenItemTheCursorItem) {
    return rundowns;
  }
  const nextItem = findItemThatFollows(items, takenItem);
  if (nextItem === undefined) {
    // The plan was carried out to its last item: the cursor is left on nothing and the
    // rundown is marked as played to its end, which the control page says in words.
    return leaveRundownCursorPastItsLastItem(rundowns, takenItem.rundownId);
  }
  return putRundownCursorOnItem(rundowns, takenItem.rundownId, nextItem.id);
}

/**
 * Puts one rundown's cursor on the given item (or on nothing, with null) and hands
 * back the rundowns. When the cursor is already there, the very same array comes back,
 * so the store neither saves nor broadcasts the rundowns. Other rundowns are untouched.
 * A cursor that moves also takes the "played to its end" mark off the rundown: the mark
 * only says how the cursor came to be on nothing, and it no longer is where that left it.
 */
export function putRundownCursorOnItem(
  rundowns: Rundown[],
  rundownId: string,
  cursorItemId: string | null,
): Rundown[] {
  const rundown = rundowns.find((candidate) => candidate.id === rundownId);
  if (rundown === undefined || rundown.cursorItemId === cursorItemId) {
    return rundowns;
  }
  return rundowns.map((candidate) =>
    candidate.id === rundownId
      ? buildRundownWithCursorAndNoEndMark(candidate, cursorItemId)
      : candidate,
  );
}

/**
 * Leaves one rundown's cursor on nothing because its last item was just taken at the
 * cursor, and marks the rundown as played to its end, so the control page can tell this
 * from a cursor nobody has placed yet. Other rundowns are untouched.
 */
export function leaveRundownCursorPastItsLastItem(
  rundowns: Rundown[],
  rundownId: string,
): Rundown[] {
  return rundowns.map((candidate) =>
    candidate.id === rundownId
      ? { ...buildRundownWithCursorAndNoEndMark(candidate, null), wasLastItemTakenAtCursor: true }
      : candidate,
  );
}

/**
 * The same rundown with its cursor on the given item and without the "played to its
 * end" mark. Written out field by field on purpose, so the mark is left out rather than
 * copied. What could go wrong: an optional field added to Rundown later is dropped here
 * until it is added to this list (a required one fails the typecheck instead).
 */
function buildRundownWithCursorAndNoEndMark(
  rundown: Rundown,
  cursorItemId: string | null,
): Rundown {
  return {
    id: rundown.id,
    name: rundown.name,
    sessionLabel: rundown.sessionLabel,
    cursorItemId,
  };
}
