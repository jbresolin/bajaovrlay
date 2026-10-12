import { useEffect } from 'react';

/** When a shortcut listens, and whether it stays out of the way of typing. */
export type KeyboardShortcutOptions = {
  /** false switches the shortcut off (for example, while the page is not connected). */
  isEnabled: boolean;
  /** true makes the shortcut ignore key presses made on a text field, dropdown or switch. */
  isIgnoredWhileTyping: boolean;
  /**
   * true keeps the key for the shortcut alone: the browser is told not to do its own
   * thing with it, both when the shortcut fires and when the key is let go. For keys the
   * browser uses itself: Space scrolls a plain page and PRESSES the button the focus is
   * on, the arrows scroll sideways. Left out means false, which is what Esc and
   * Backspace want.
   */
  isKeptFromTheBrowser?: boolean;
};

/** What a shortcut is told about the press that fired it. */
export type KeyPress = {
  /** true when Shift was down with the key. Only Space gives it a meaning of its own. */
  isShiftHeld: boolean;
};

/**
 * Calls `onPressed` when `key` (a KeyboardEvent.key value such as 'Escape') is pressed
 * anywhere on the page. Three kinds of press never count, because each would send a
 * command the operator did not mean: a key held down (the keyboard's auto-repeat), a key
 * with Ctrl/Alt/Meta (a browser shortcut), and a key another control already used
 * (Esc closing an open dropdown, Space picking a rundown row up for a keyboard drag).
 *
 * Shift is not one of those: a key pressed with Shift counts like the key alone, as it
 * always did here, and `onPressed` is told whether Shift was down. A shortcut that does
 * not look at that (Esc, Backspace, the arrows) does the same with and without Shift.
 */
export function useKeyboardShortcut(
  key: string,
  onPressed: (keyPress: KeyPress) => void,
  options: KeyboardShortcutOptions,
): void {
  const { isEnabled, isIgnoredWhileTyping } = options;
  const isKeptFromTheBrowser = options.isKeptFromTheBrowser ?? false;

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
      if (isKeptFromTheBrowser) {
        event.preventDefault();
      }
      onPressed({ isShiftHeld: event.shiftKey });
    }

    // A browser presses the focused button when Space is LET GO, not when it goes down,
    // and browsers disagree on whether refusing the key going down is enough to stop
    // that (it is not after a held key, nor in Firefox). So a key kept from the browser
    // is refused on its way up as well. This is safe for the two controls that use the
    // key themselves: a keyboard drag acts when the key goes down, and the switch and
    // the dropdowns are "typing" places, which are left alone here as above.
    function handleKeyUp(event: KeyboardEvent): void {
      if (event.key !== key) {
        return;
      }
      const hasModifierKey = event.ctrlKey || event.altKey || event.metaKey;
      if (hasModifierKey) {
        return;
      }
      if (isIgnoredWhileTyping && isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener('keydown', handleKeyDown);
    if (isKeptFromTheBrowser) {
      window.addEventListener('keyup', handleKeyUp);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // Deliberate: callers pass a new `onPressed` function on every render, so the listeners
    // are removed and added again each time. That is cheap and never leaves two listeners;
    // holding the callback in a ref would avoid it at the price of a less obvious hook.
  }, [key, onPressed, isEnabled, isIgnoredWhileTyping, isKeptFromTheBrowser]);
}

/**
 * Whether a key press landed on a form control: somewhere the operator types, picks a
 * value or flips a switch.
 */
function isTypingTarget(eventTarget: EventTarget | null): boolean {
  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }
  // The browser's own controls. The page has no native <select> today; it stays in the
  // list so one added later is covered without anyone remembering this file.
  const isFormField =
    eventTarget instanceof HTMLInputElement ||
    eventTarget instanceof HTMLTextAreaElement ||
    eventTarget instanceof HTMLSelectElement;
  // The shadcn/ui dropdown and switch are built from buttons and divs, so they can only
  // be recognised by their role. A closed dropdown is a "combobox"; its open list is a
  // "listbox" with the options inside it. Neither uses Backspace itself, so without
  // this check a Backspace on them would reach the shortcut and take the clock off air.
  const isInsideDropdown = eventTarget.closest('[role="combobox"], [role="listbox"]') !== null;
  const isOnSwitch = eventTarget.closest('[role="switch"]') !== null;
  return isFormField || eventTarget.isContentEditable || isInsideDropdown || isOnSwitch;
}
