import type { Command } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/**
 * One shortcut of the control page: everything about it in one entry, so the listeners
 * (useKeyboardShortcut.ts and the hooks that call it) and the "?" dialog read the same
 * thing and cannot drift apart.
 */
export type KeyboardShortcut = {
  /** The KeyboardEvent.key values that fire it (' ' is the space bar). */
  keys: readonly string[];
  /**
   * true for the one shortcut that needs Shift (Shift+Space). Every other shortcut fires
   * with or without Shift, as it always did here; only Space gives Shift a meaning, and
   * the Space listener reads it through isPressOfShortcut.
   */
  isShiftHeld: boolean;
  /**
   * true leaves the key alone in a text field, a dropdown, an open menu or a switch (only
   * Esc is false).
   */
  isIgnoredWhileTyping: boolean;
  /**
   * true tells the browser not to do its own thing with the key (scroll, press the
   * focused button, open its help), when the shortcut fires and when the key is let go.
   */
  isKeptFromTheBrowser: boolean;
  /**
   * The commands a press may send; empty for a key that only changes the page (F1–F4).
   * Descriptive only: no code reads it. It tells the reader where to look; what a key
   * really sends is decided by the hook that listens to it (commandForOperatorKey.ts,
   * quickFireTabs.ts, the "Limpar tudo" button).
   */
  commandTypes: readonly Command['type'][];
  /** The key as the operator reads it in the "?" dialog ("Espaço", "1 a 9"). */
  keyName: string;
  /** Where and when it works, in pt-BR. */
  condition: string;
  /** What it does, in pt-BR. */
  description: string;
};

const shortcutTexts = ptBR.keyboard.shortcuts;

/**
 * Every shortcut of the control page, by name. The rules below are the ones decided task
 * by task (docs/decisions.md, PR #5, #8 and #12 and their gate-2 lines); this file only
 * gathers them, and changing one here changes what the key does: `keys`,
 * `isIgnoredWhileTyping` and `isKeptFromTheBrowser` drive the listeners, `isShiftHeld`
 * tells Shift+Space from Space, the order of switchQuickFireTab's keys is the order of
 * the tabs they open (quickFireTabs.ts), and the texts fill the "?" dialog. Only
 * `commandTypes` is descriptive.
 *
 * The routing of Space, Shift+Space and Backspace (which command, given what is
 * previewed) is commandForOperatorKey.ts; its three names (`space`, `shiftSpace`,
 * `backspace`) are the entries takeNext, previewCursorItem and discardPreview.
 */
export const keyboardMap = {
  takeNext: {
    keys: [' '],
    isShiftHeld: false,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: true,
    commandTypes: ['takePreview', 'takeNext'],
    ...shortcutTexts.takeNext,
  },
  previewCursorItem: {
    keys: [' '],
    isShiftHeld: true,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: true,
    commandTypes: ['previewItem'],
    ...shortcutTexts.previewCursorItem,
  },
  cursorForward: {
    keys: ['ArrowRight'],
    isShiftHeld: false,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: true,
    commandTypes: ['moveCursor'],
    ...shortcutTexts.cursorForward,
  },
  cursorBack: {
    keys: ['ArrowLeft'],
    isShiftHeld: false,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: true,
    commandTypes: ['moveCursor'],
    ...shortcutTexts.cursorBack,
  },
  discardPreview: {
    keys: ['Backspace'],
    isShiftHeld: false,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: false,
    commandTypes: ['stopPreview'],
    ...shortcutTexts.discardPreview,
  },
  // The panic key works even while typing in a field (PR #5).
  clearAll: {
    keys: ['Escape'],
    isShiftHeld: false,
    isIgnoredWhileTyping: false,
    isKeptFromTheBrowser: false,
    commandTypes: ['clearAll'],
    ...shortcutTexts.clearAll,
  },
  // The browser does nothing with a digit outside a field, so nothing is kept from it.
  fireQuickFireButton: {
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    isShiftHeld: false,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: false,
    commandTypes: ['takeItem', 'runMacro'],
    ...shortcutTexts.fireQuickFireButton,
  },
  // F1 opens the browser's help in some browsers, F3 its search; both are kept from it.
  switchQuickFireTab: {
    keys: ['F1', 'F2', 'F3', 'F4'],
    isShiftHeld: false,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: true,
    commandTypes: [],
    ...shortcutTexts.switchQuickFireTab,
  },
} as const satisfies Record<string, KeyboardShortcut>;

/**
 * Answers whether a press is this shortcut's: one of its keys, with Shift down exactly
 * when the shortcut needs it. This is how the Space listener tells Shift+Space
 * (previewCursorItem) from Space (takeNext), both of which share the space bar.
 */
export function isPressOfShortcut(
  keyPress: { key: string; isShiftHeld: boolean },
  shortcut: Pick<KeyboardShortcut, 'keys' | 'isShiftHeld'>,
): boolean {
  const isOneOfItsKeys = shortcut.keys.includes(keyPress.key);
  const isShiftAsItNeeds = keyPress.isShiftHeld === shortcut.isShiftHeld;
  return isOneOfItsKeys && isShiftAsItNeeds;
}

/**
 * Every shortcut, in the order the "?" dialog lists them: rundown keys first. Written by
 * hand because the order is a choice; keyboardMap.test.ts checks it holds every entry
 * of the map exactly once, so a new entry cannot be missing from the help.
 */
export function listKeyboardShortcutsInDialogOrder(): KeyboardShortcut[] {
  return [
    keyboardMap.takeNext,
    keyboardMap.previewCursorItem,
    keyboardMap.cursorForward,
    keyboardMap.cursorBack,
    keyboardMap.discardPreview,
    keyboardMap.clearAll,
    keyboardMap.fireQuickFireButton,
    keyboardMap.switchQuickFireTab,
  ];
}
