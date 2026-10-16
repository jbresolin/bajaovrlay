/** What is known once the server has accepted a take this page sent. */
export type TakeThatWasAccepted = {
  /** Whether "Prévia automática" is on in this browser. */
  isAutoPreviewOn: boolean;
  /** The item the rundown's cursor was on when the take was sent; null for "on nothing". */
  cursorItemIdBeforeTake: string | null;
  /** The item the cursor is on now that the take was accepted; null for "on nothing". */
  cursorItemIdAfterTake: string | null;
};

/**
 * Says which item to preview after an accepted take: the item the cursor moved on to,
 * while "Prévia automática" is on. Null means "preview nothing": the switch is off, the
 * take left the cursor where it was (a row that was not the next one was fired, or
 * "Tomar" aired a preview that was not of the cursor item), or the cursor is on nothing
 * (the last item was taken).
 * João's ruling, gate 2 of BAJAOVRLAY-15: this is what makes Space, Space the loop.
 */
export function findItemIdToPreviewAfterTake(take: TakeThatWasAccepted): string | null {
  if (!take.isAutoPreviewOn) {
    return null;
  }
  const hasCursorMoved = take.cursorItemIdAfterTake !== take.cursorItemIdBeforeTake;
  if (!hasCursorMoved) {
    return null;
  }
  return take.cursorItemIdAfterTake;
}
