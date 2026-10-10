import { useEffect } from 'react';

/** When a shortcut listens, and whether it stays out of the way of typing. */
export type KeyboardShortcutOptions = {
  /** false switches the shortcut off (for example, while the page is not connected). */
  isEnabled: boolean;
  /** true makes the shortcut ignore key presses made inside a text field or dropdown. */
  isIgnoredWhileTyping: boolean;
};

/**
 * Calls `onPressed` when `key` (a KeyboardEvent.key value such as 'Escape') is pressed
 * anywhere on the page. Three kinds of press never count, because each would send a
 * command the operator did not mean: a key held down (the keyboard's auto-repeat), a key
 * with Ctrl/Alt/Meta (a browser shortcut), and a key another control already used
 * (Esc closing an open dropdown).
 */
export function useKeyboardShortcut(
  key: string,
  onPressed: () => void,
  options: KeyboardShortcutOptions,
): void {
  const { isEnabled, isIgnoredWhileTyping } = options;

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== key) {
        return;
      }
      const isHeldDown = event.repeat;
      const hasModifierKey = event.ctrlKey || event.altKey || event.metaKey;
      const wasUsedByAnotherControl = event.defaultPrevented;
      if (isHeldDown || hasModifierKey || wasUsedByAnotherControl) {
        return;
      }
      if (isIgnoredWhileTyping && isTypingTarget(event.target)) {
        return;
      }
      onPressed();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [key, onPressed, isEnabled, isIgnoredWhileTyping]);
}

/** Whether a key press landed somewhere the operator types or picks a value. */
function isTypingTarget(eventTarget: EventTarget | null): boolean {
  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }
  const isFormField =
    eventTarget instanceof HTMLInputElement ||
    eventTarget instanceof HTMLTextAreaElement ||
    eventTarget instanceof HTMLSelectElement;
  return isFormField || eventTarget.isContentEditable;
}
