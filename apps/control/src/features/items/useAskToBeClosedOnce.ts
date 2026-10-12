import { useEffect, useRef } from 'react';

/** What useAskToBeClosedOnce hands the item editor. */
export type AskToBeClosedOnce = {
  /** Asks the rundown to close the editor: for "Cancelar" and for a finished press. */
  askToBeClosedOnce: () => void;
  /**
   * Whether the editor has finished with this item: it already asked to be closed, or it
   * left the page. A press still under way asks this before every command it sends.
   */
  hasEditorFinishedWithThisItem: () => boolean;
};

/**
 * Returns the function the item editor calls to ask the rundown to close it, and the
 * question "has this editor finished with its item?". `onClose` is called at most once,
 * and never after the editor left the page.
 *
 * Why: a save can still be waiting for the server when the operator presses "Cancelar"
 * or opens another item. Without this, the late "accepted" would call `onClose` a second
 * time and could close an editor the operator has opened since, and the press that was
 * waiting would go on to send its next command (the on-air update of "Atualizar no ar")
 * from an editor that is no longer there.
 */
export function useAskToBeClosedOnce(onClose: () => void): AskToBeClosedOnce {
  const hasFinishedWithThisItemRef = useRef(false);
  useEffect(() => {
    hasFinishedWithThisItemRef.current = false;
    return () => {
      hasFinishedWithThisItemRef.current = true;
    };
  }, []);

  function askToBeClosedOnce(): void {
    if (hasFinishedWithThisItemRef.current) {
      return;
    }
    hasFinishedWithThisItemRef.current = true;
    onClose();
  }

  function hasEditorFinishedWithThisItem(): boolean {
    return hasFinishedWithThisItemRef.current;
  }

  return { askToBeClosedOnce, hasEditorFinishedWithThisItem };
}
