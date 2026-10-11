import { useEffect } from 'react';

/**
 * While a rundown row is held or dragged, marks every Esc press as "already used", so
 * that the Esc which cancels the drag cannot also count as a press of the panic key
 * (Esc arms "Limpar tudo", and a second Esc takes every graphic off air).
 *
 * Why it is needed: dnd-kit cancels a mouse drag on Esc without telling the browser the
 * key was used (its keyboard drag does tell). The page's shortcuts skip a key another
 * control used, and the only sign of that they can read is `defaultPrevented`.
 *
 * How: the listener runs in the capture phase, which is before dnd-kit's own listener
 * and before the shortcuts' listener on the window, and calls `preventDefault`. dnd-kit
 * does not look at that mark, so the drag is still cancelled.
 *
 * What could go wrong: the mark is put on EVERY Esc while `isDragActiveOrPending` is
 * true, so a caller that never sets it back to false would switch the panic key off.
 * RundownItemList sets it back at the end, the cancel and the abort of a drag.
 */
export function useEscapeBelongsToTheDragWhileDragging(isDragActiveOrPending: boolean): void {
  useEffect(() => {
    if (!isDragActiveOrPending) {
      return;
    }

    function markEscapeAsUsedByTheDrag(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
      }
    }

    const beforeEveryOtherListener = { capture: true };
    document.addEventListener('keydown', markEscapeAsUsedByTheDrag, beforeEveryOtherListener);
    return () => {
      document.removeEventListener('keydown', markEscapeAsUsedByTheDrag, beforeEveryOtherListener);
    };
  }, [isDragActiveOrPending]);
}
