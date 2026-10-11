import type { Rundown } from '@bajaovrlay/shared';

/**
 * Puts one rundown's cursor on the given item (or on nothing, with null) and hands
 * back the rundowns. When the cursor is already there, the very same array comes back,
 * so the store neither saves nor broadcasts the rundowns. Other rundowns are untouched.
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
    candidate.id === rundownId ? { ...candidate, cursorItemId } : candidate,
  );
}
