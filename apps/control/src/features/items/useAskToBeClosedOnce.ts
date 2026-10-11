import { useEffect, useRef } from 'react';

/**
 * Returns the function the item editor calls to ask the rundown to close it. It calls
 * `onClose` at most once, and never after the editor left the page.
 *
 * Why: a save can still be waiting for the server when the operator presses "Cancelar"
 * or opens another item. Without this, the late "accepted" would call `onClose` a second
 * time and could close an editor the operator has opened since.
 */
export function useAskToBeClosedOnce(onClose: () => void): () => void {
  const hasFinishedWithThisItemRef = useRef(false);
  useEffect(() => {
    hasFinishedWithThisItemRef.current = false;
    return () => {
      hasFinishedWithThisItemRef.current = true;
    };
  }, []);

  return function askToBeClosedOnce(): void {
    if (hasFinishedWithThisItemRef.current) {
      return;
    }
    hasFinishedWithThisItemRef.current = true;
    onClose();
  };
}
