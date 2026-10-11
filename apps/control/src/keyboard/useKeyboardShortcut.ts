import { useEffect } from 'react';

/** When a shortcut listens, and whether it stays out of the way of typing. */
export type KeyboardShortcutOptions = {
  /** false switches the shortcut off (for example, while the page is not connected). */
  isEnabled: boolean;
  /** true makes the shortcut ignore key presses made on a text field, dropdown or switch. */
  isIgnoredWhileTyping: boolean;
  /**
   * true makes the shortcut ignore key presses made while the focus is on a button or a
   * link. For keys those controls use themselves: Space presses the focused button, and
   * a shortcut on Space that fired as well would do two things with one press.
   * Left out means false, which is what Esc and Backspace want.
   */
  isIgnoredOnButtonsAndLinks?: boolean;
  /**
   * true stops the browser from also doing its own thing with the key once the shortcut
   * has fired. For keys the browser uses on a plain page: Space scrolls down and the
   * Right arrow scrolls sideways. Left out means false.
   */
  isKeptFromTheBrowser?: boolean;
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
  const isIgnoredOnButtonsAndLinks = options.isIgnoredOnButtonsAndLinks ?? false;
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
      if (isIgnoredOnButtonsAndLinks && isButtonOrLinkTarget(event.target)) {
        return;
      }
      if (isKeptFromTheBrowser) {
        event.preventDefault();
      }
      onPressed();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // Deliberate: callers pass a new `onPressed` function on every render, so the listener
    // is removed and added again each time. That is cheap and never leaves two listeners;
    // holding the callback in a ref would avoid it at the price of a less obvious hook.
  }, [
    key,
    onPressed,
    isEnabled,
    isIgnoredWhileTyping,
    isIgnoredOnButtonsAndLinks,
    isKeptFromTheBrowser,
  ]);
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

/**
 * Whether a key press landed on something the keyboard "presses": a button, a link, or
 * an element that plays one of those parts through its role (the radio buttons and
 * checkboxes of shadcn/ui are buttons underneath; a drag handle has the role "button").
 */
function isButtonOrLinkTarget(eventTarget: EventTarget | null): boolean {
  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }
  const closestPressableControl = eventTarget.closest(
    'button, a[href], summary, [role="button"], [role="radio"], [role="checkbox"]',
  );
  return closestPressableControl !== null;
}
