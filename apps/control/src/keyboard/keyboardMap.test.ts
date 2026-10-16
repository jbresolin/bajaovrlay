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
 *   - The map holds exactly the nine shortcuts (M1's eight and P, "Parar" a running
 *     macro, from PR #13's gate 2), in the order the dialog lists them,
 *     and the dialog's hand-written list holds every entry of the map exactly once.
 *   - A press is told to be an entry's by the entry's keys and Shift rule, which is how
 *     Space and Shift+Space are told apart.
 *   - Each shortcut keeps the rules decided for it in earlier tasks (docs/decisions.md):
 *     only Esc works while typing; Space, the arrows and F1–F4 are kept from the browser,
 *     Esc, Backspace, the digits and P are not.
 *   - No key press is claimed by two shortcuts, and every shortcut has words for the
 *     operator.
 *   - 1–9 are the nine digit keys and F1–F4 the first four function keys; P is the
 *     letter p in either case (Caps Lock sends "P").
 *
 * What these tests deliberately do not cover:
 *   - What each key does on the page: RundownPanelKeyboard*.test.tsx, ClearAllButton.test.tsx,
 *     App.test.tsx (Backspace) and QuickFireStripKeys.test.tsx press the keys for real.
 *   - The dialog that lists the map: KeyboardMapDialog.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import {
  isPressOfShortcut,
  keyboardMap,
  type KeyboardShortcut,
  listKeyboardShortcutsInDialogOrder,
} from './keyboardMap';

describe('the keyboard map', () => {
  it('lists the nine shortcuts, in the order the dialog shows them', () => {
    // Arrange: nothing to set up; the map is a constant.

    // Act: read the names the operator sees, in the dialog's order.
    const keyNames = listKeyboardShortcutsInDialogOrder().map((shortcut) => shortcut.keyName);

    // Assert: the nine shortcuts, the take first, the panic key after the cursor keys, and
    // the macro's "Parar" after the strip's keys.
    expect(keyNames, 'the dialog must list the nine shortcuts in this order').toEqual([
      'Espaço',
      'Shift + Espaço',
      '→',
      '←',
      'Backspace',
      'Esc',
      '1 a 9',
      'F1 a F4',
      'P',
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
    // A p typed into a field is a letter ("Patrocinadores"); on the page the browser does
    // nothing with it, so there is nothing to keep it from.
    {
      name: 'P',
      shortcut: keyboardMap.stopRunningMacro,
      worksWhileTyping: false,
      isKept: false,
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

  it('lists in the dialog every entry of the map, each exactly once', () => {
    // Arrange: every entry the map holds, whatever its name.
    const entriesOfTheMap: KeyboardShortcut[] = Object.values(keyboardMap);

    // Act: read the dialog's hand-written list.
    const entriesOfTheDialog = listKeyboardShortcutsInDialogOrder();

    // Assert: no entry is left out, none is listed twice, and nothing is listed that the
    // map does not hold, so a shortcut added to the map cannot be missing from the help.
    expect(
      entriesOfTheDialog.length,
      'the dialog must list as many shortcuts as the map holds',
    ).toBe(entriesOfTheMap.length);
    expect(new Set(entriesOfTheDialog).size, 'the dialog must list each shortcut only once').toBe(
      entriesOfTheDialog.length,
    );
    expect(
      new Set(entriesOfTheDialog),
      'the dialog must list exactly the entries of the map',
    ).toEqual(new Set(entriesOfTheMap));
  });

  const pressScenarios = [
    // Space alone is the take, not the preview.
    {
      name: 'Space alone is not Shift+Space',
      keyPress: { key: ' ', isShiftHeld: false },
      shortcut: keyboardMap.previewCursorItem,
      expected: false,
    },
    // Shift with Space is the preview of the cursor item.
    {
      name: 'Shift with Space is Shift+Space',
      keyPress: { key: ' ', isShiftHeld: true },
      shortcut: keyboardMap.previewCursorItem,
      expected: true,
    },
    // Shift with another key is not Shift+Space: the key must be one of the entry's keys.
    {
      name: 'Shift with → is not Shift+Space',
      keyPress: { key: 'ArrowRight', isShiftHeld: true },
      shortcut: keyboardMap.previewCursorItem,
      expected: false,
    },
    // An entry that does not need Shift is matched only without it.
    {
      name: 'Space alone is Space',
      keyPress: { key: ' ', isShiftHeld: false },
      shortcut: keyboardMap.takeNext,
      expected: true,
    },
  ];

  it.each(pressScenarios)('$name', ({ keyPress, shortcut, expected }) => {
    // Arrange: the press and the map entry of this row.

    // Act: ask whether the press is that entry's.
    const isThatShortcut = isPressOfShortcut(keyPress, shortcut);

    // Assert: the answer the entry's keys and Shift rule give.
    expect(isThatShortcut, 'the press must match the entry by its keys and Shift rule').toBe(
      expected,
    );
  });

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

  it('stops a running macro with the letter p in either case', () => {
    // Arrange: nothing to set up.

    // Act: read the keys of the stop shortcut.
    const stopKeys = keyboardMap.stopRunningMacro.keys;

    // Assert: p and P, so Caps Lock does not switch "Parar" off.
    expect(stopKeys, '"Parar" must be the letter p, small or capital').toEqual(['p', 'P']);
  });
});
