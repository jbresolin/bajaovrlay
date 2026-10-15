/**
 * The keyboard map (apps/control)
 *
 * What this module is for:
 *   keyboardMap.ts is the one list of every shortcut of the control page: which keys fire
 *   it, where it is left alone (while typing, kept from the browser), which command it
 *   sends and what the operator reads about it in pt-BR. The hooks that listen to the keys
 *   read their keys and their rules from it, and the "?" dialog lists it, so the help on
 *   screen cannot drift from what the keys do.
 *
 * What these tests prove:
 *   - The map holds exactly the eight shortcuts of M1, in the order the dialog lists them.
 *   - Each shortcut keeps the rules decided for it in earlier tasks (docs/decisions.md):
 *     only Esc works while typing; Space, the arrows and F1–F4 are kept from the browser,
 *     Esc, Backspace and the digits are not.
 *   - No key press is claimed by two shortcuts, and every shortcut has words for the
 *     operator.
 *   - 1–9 are the nine digit keys and F1–F4 the first four function keys.
 *
 * What these tests deliberately do not cover:
 *   - What each key does on the page: RundownPanelKeyboard*.test.tsx, ClearAllButton.test.tsx,
 *     App.test.tsx (Backspace) and QuickFireStripKeys.test.tsx press the keys for real.
 *   - The dialog that lists the map: KeyboardMapDialog.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { keyboardMap, listKeyboardShortcutsInDialogOrder } from './keyboardMap';

describe('the keyboard map', () => {
  it('lists the eight shortcuts of M1, in the order the dialog shows them', () => {
    // Arrange: nothing to set up; the map is a constant.

    // Act: read the names the operator sees, in the dialog's order.
    const keyNames = listKeyboardShortcutsInDialogOrder().map((shortcut) => shortcut.keyName);

    // Assert: the eight shortcuts, the take first and the panic key after the cursor keys.
    expect(keyNames, 'the dialog must list the eight M1 shortcuts in this order').toEqual([
      'Espaço',
      'Shift + Espaço',
      '→',
      '←',
      'Backspace',
      'Esc',
      '1 a 9',
      'F1 a F4',
    ]);
  });

  const rulesPerShortcut = [
    // Space takes even with the focus on a button, and must never scroll or press it.
    { name: 'Space', shortcut: keyboardMap.takeNext, worksWhileTyping: false, isKept: true },
    // Shift+Space shares Space's listener, so it shares its rules.
    {
      name: 'Shift+Space',
      shortcut: keyboardMap.previewCursorItem,
      worksWhileTyping: false,
      isKept: true,
    },
    // The arrows must not scroll the page sideways.
    {
      name: 'ArrowRight',
      shortcut: keyboardMap.cursorForward,
      worksWhileTyping: false,
      isKept: true,
    },
    { name: 'ArrowLeft', shortcut: keyboardMap.cursorBack, worksWhileTyping: false, isKept: true },
    // Backspace erases a character in a field; on the page it only discards a preview.
    {
      name: 'Backspace',
      shortcut: keyboardMap.discardPreview,
      worksWhileTyping: false,
      isKept: false,
    },
    // Esc is the panic key: it works everywhere, typing included (PR #5).
    { name: 'Esc', shortcut: keyboardMap.clearAll, worksWhileTyping: true, isKept: false },
    // A digit typed into a field is a digit, not a take; on the page the browser does
    // nothing with it, so there is nothing to keep it from.
    {
      name: '1 to 9',
      shortcut: keyboardMap.fireQuickFireButton,
      worksWhileTyping: false,
      isKept: false,
    },
    // F1 opens the browser's help in some browsers, so the key is kept from it.
    {
      name: 'F1 to F4',
      shortcut: keyboardMap.switchQuickFireTab,
      worksWhileTyping: false,
      isKept: true,
    },
  ];

  it.each(rulesPerShortcut)(
    'keeps the decided rules for $name',
    ({ shortcut, worksWhileTyping, isKept }) => {
      // Arrange: the shortcut's entry, taken from the map above.

      // Act: read its two rules.
      const { isIgnoredWhileTyping, isKeptFromTheBrowser } = shortcut;

      // Assert: both are what earlier tasks decided.
      expect(isIgnoredWhileTyping, 'only Esc may fire while the operator types in a field').toBe(
        !worksWhileTyping,
      );
      expect(
        isKeptFromTheBrowser,
        'the key must be kept from the browser exactly when the browser would act on it',
      ).toBe(isKept);
    },
  );

  it('gives every key press to one shortcut only', () => {
    // Arrange: every shortcut of the map.
    const shortcuts = listKeyboardShortcutsInDialogOrder();

    // Act: write each press as "key with or without Shift".
    const presses = shortcuts.flatMap((shortcut) =>
      shortcut.keys.map((key) => `${key}|${shortcut.isShiftHeld ? 'shift' : 'plain'}`),
    );

    // Assert: no press appears twice.
    expect(new Set(presses).size, 'two shortcuts must never claim the same press').toBe(
      presses.length,
    );
  });

  it('gives every shortcut words for the operator and at least one key', () => {
    // Arrange: every shortcut of the map.
    const shortcuts = listKeyboardShortcutsInDialogOrder();

    // Act: find any shortcut missing a key or a text.
    const shortcutsMissingSomething = shortcuts.filter(
      (shortcut) =>
        shortcut.keys.length === 0 ||
        shortcut.keyName.trim() === '' ||
        shortcut.condition.trim() === '' ||
        shortcut.description.trim() === '',
    );

    // Assert: none.
    expect(
      shortcutsMissingSomething,
      'every shortcut needs a key, a name, a condition and a description in pt-BR',
    ).toEqual([]);
  });

  it('fires the quick-fire buttons with the digits 1 to 9 and switches tabs with F1 to F4', () => {
    // Arrange: nothing to set up.

    // Act: read the keys of the two quick-fire shortcuts.
    const buttonKeys = keyboardMap.fireQuickFireButton.keys;
    const tabKeys = keyboardMap.switchQuickFireTab.keys;

    // Assert: the nine digits in order, and the first four function keys in order.
    expect(buttonKeys, 'the buttons must be fired by 1 to 9, in order').toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ]);
    expect(tabKeys, 'the tabs must be switched by F1 to F4, in order').toEqual([
      'F1',
      'F2',
      'F3',
      'F4',
    ]);
  });
});
