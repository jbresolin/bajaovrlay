import { useEffect } from 'react';

import type { KeyboardShortcut } from './keyboardMap';

/** The part of a keyboardMap.ts entry the listener needs: its keys and its two rules. */
export type ShortcutToListenFor = Pick<
  KeyboardShortcut,
  'keys' | 'isIgnoredWhileTyping' | 'isKeptFromTheBrowser'
>;

/** When a shortcut listens. */
export type KeyboardShortcutOptions = {
  /** false switches the shortcut off (for example, while the page is not connected). */
  isEnabled: boolean;
};

/** What a shortcut is told about the press that fired it. */
export type KeyPress = {
  /** Which of the shortcut's keys was pressed (KeyboardEvent.key), such as '3' or 'F2'. */
  key: string;
  /** true when Shift was down with the key. Only Space gives it a meaning of its own. */
  isShiftHeld: boolean;
};

/**
 * Calls `onPressed` when one of the shortcut's keys is pressed anywhere on the page. The
 * shortcut is an entry of keyboardMap.ts, which says which keys fire it and its two
 * rules: `isIgnoredWhileTyping` (leave a key alone in a text field, dropdown, open menu
 * or switch)
 * and `isKeptFromTheBrowser` (tell the browser not to scroll, press the focused button
 * or open its help, both when the shortcut fires and when the key is let go).
 *
 * Three kinds of press never count, because each would send a command the operator did
 * not mean: a key held down (the keyboard's auto-repeat), a key with Ctrl/Alt/Meta (a
 * browser shortcut), and a key another control already used (Esc closing an open
 * dropdown, menu or dialog, Space picking a rundown row up for a keyboard drag).
 *
 * Shift is not one of those: a key pressed with Shift counts like the key alone, as it
 * always did here, and `onPressed` is told whether Shift was down. A shortcut that does
 * not look at that (Esc, Backspace, the arrows) does the same with and without Shift.
 */
export function useKeyboardShortcut(
  shortcut: ShortcutToListenFor,
  onPressed: (keyPress: KeyPress) => void,
  options: KeyboardShortcutOptions,
): void {
  const { isEnabled } = options;
  const { keys, isIgnoredWhileTyping, isKeptFromTheBrowser } = shortcut;

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (!keys.includes(event.key)) {
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
      onPressed({ key: event.key, isShiftHeld: event.shiftKey });
    }

    // A browser presses the focused button when Space is LET GO, not when it goes down,
    // and browsers disagree on whether refusing the key going down is enough to stop
    // that (it is not after a held key, nor in Firefox). So a key kept from the browser
    // is refused on its way up as well. This is safe for the two controls that use the
    // key themselves: a keyboard drag acts when the key goes down, and the switch and
    // the dropdowns are "typing" places, which are left alone here as above.
    function handleKeyUp(event: KeyboardEvent): void {
      if (!keys.includes(event.key)) {
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
  }, [keys, onPressed, isEnabled, isIgnoredWhileTyping, isKeptFromTheBrowser]);
}

/**
 * Whether a key press landed on a form control or an open menu: somewhere the operator
 * types, picks a value, chooses an action or flips a switch.
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
  // this check a Backspace on them would reach the shortcut and discard a preview.
  const isInsideDropdown = eventTarget.closest('[role="combobox"], [role="listbox"]') !== null;
  // An open Radix menu (a quick-fire button's "⋯") is the same kind of place: the
  // operator is choosing in it. Radix marks only the keys it uses (Space, Enter, the
  // up/down arrows, Esc), so a digit, Backspace or ←/→ pressed on a menu item would
  // otherwise take a button, discard a preview or move the cursor. Esc is not affected:
  // it is not ignored while typing, and the Esc that closes a menu is marked by Radix.
  const isInsideMenu = eventTarget.closest('[role="menu"]') !== null;
  const isOnSwitch = eventTarget.closest('[role="switch"]') !== null;
  return (
    isFormField || eventTarget.isContentEditable || isInsideDropdown || isInsideMenu || isOnSwitch
  );
}
