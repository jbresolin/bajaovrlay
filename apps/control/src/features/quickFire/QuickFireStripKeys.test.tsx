/**
 * The quick-fire strip's keys: 1 to 9 and F1 to F4 (apps/control)
 *
 * What this module is for:
 *   The digits 1 to 9 fire the first nine buttons of the tab shown (on "Macros", the
 *   first nine macros), and F1 to F4 open the first four tabs, "Macros" counting where it
 *   is drawn (last). The keys and their rules come from src/keyboard/keyboardMap.ts;
 *   which command a digit sends is quickFireTabs.ts. This file presses the keys on the
 *   page as an operator does.
 *
 * What these tests prove:
 *   - 1 and 3 take the first and third buttons of the panel shown, in button order.
 *   - F2 opens the second tab, after which 1 fires that panel's first button (none here).
 *   - On "Macros" (F3 with two panels) 2 runs the second macro.
 *   - F1 to F4 are kept from the browser (its help page); a digit is not.
 *   - A digit typed in a text field is a digit: nothing is fired. A held key fires once.
 *   - An F-key past the last tab changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - The rules every shortcut shares (Ctrl/Alt/Meta, a key used by another control,
 *     the connection): useKeyboardShortcut.ts holds them once, and the rundown's key
 *     tests (RundownPanelKeyboard.test.tsx) press them.
 *   - Which button a digit reaches in edge cases: quickFireTabs.test.ts.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  bajaLogoItemId,
  buildSlicesWithShortcutsAndMacros,
  closeTheSessionMacroId,
  redFlagItemId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { QuickFireStrip } from './QuickFireStrip';

/** Presses one key on the page, as the operator does with the focus on nothing. */
function pressKeyOnThePage(key: string): boolean {
  // fireEvent answers false when a listener called preventDefault on the press.
  return fireEvent.keyDown(document.body, { key });
}

/** Draws the strip on a connected page holding two panels and two macros. */
function renderStrip() {
  return renderOnControlPageConnectedToFakeServer(
    <QuickFireStrip />,
    buildSlicesWithShortcutsAndMacros(),
  );
}

describe('the digits 1 to 9', () => {
  it('take the first and third buttons of the panel shown', () => {
    // Arrange: the strip, on "Atalhos".
    const { fakeServer } = renderStrip();

    // Act: press 1, then 3.
    pressKeyOnThePage('1');
    fakeServer.acceptLastCommand();
    pressKeyOnThePage('3');

    // Assert: the first and the third buttons, by button order.
    expect(
      fakeServer.listCommandsReceived(),
      '1 and 3 must take the first and third buttons of the panel shown',
    ).toEqual([
      { type: 'takeItem', itemId: bajaLogoItemId },
      { type: 'takeItem', itemId: redFlagItemId },
    ]);
  });

  it('fire nothing when a digit is typed into a text field', () => {
    // Arrange: the strip, with the new-panel name field open and focused.
    const { fakeServer } = renderStrip();
    fireEvent.click(screen.getByRole('button', { name: '+ Painel' }));
    const nameField = screen.getByLabelText('Nome do novo painel');

    // Act: type a 2 into the field.
    fireEvent.keyDown(nameField, { key: '2' });

    // Assert: nothing fired.
    expect(fakeServer.listCommandsReceived(), 'a digit typed in a field must fire nothing').toEqual(
      [],
    );
  });

  it('fire once when the key is held down', () => {
    // Arrange: the strip.
    const { fakeServer } = renderStrip();

    // Act: press 1, then the keyboard repeats it while held.
    pressKeyOnThePage('1');
    fireEvent.keyDown(document.body, { key: '1', repeat: true });

    // Assert: one take.
    expect(
      fakeServer.listCommandsReceived(),
      'a held digit must not fire the button again and again',
    ).toHaveLength(1);
  });

  it('are not kept from the browser', () => {
    // Arrange: the strip.
    renderStrip();

    // Act: press 1.
    const wasLeftToTheBrowser = pressKeyOnThePage('1');

    // Assert: the press was not cancelled.
    expect(wasLeftToTheBrowser, 'a digit must not be kept from the browser').toBe(true);
  });
});

describe('F1 to F4', () => {
  it('open the second tab with F2, after which 1 fires that panel’s buttons', () => {
    // Arrange: the strip, on "Atalhos".
    const { fakeServer } = renderStrip();

    // Act: F2, then 1.
    pressKeyOnThePage('F2');
    pressKeyOnThePage('1');

    // Assert: "Box" is shown, and being empty it fired nothing.
    expect(screen.getByRole('tab', { name: 'Box' }), 'F2 must open the second tab').toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(fakeServer.listCommandsReceived(), '1 on an empty panel must fire nothing').toEqual([]);
  });

  it('reach Macros, where the digits run macros', () => {
    // Arrange: the strip; with two panels, "Macros" is the third tab.
    const { fakeServer } = renderStrip();

    // Act: F3, then 2.
    pressKeyOnThePage('F3');
    pressKeyOnThePage('2');

    // Assert: "Macros" is shown and the second macro was run.
    expect(
      screen.getByRole('tab', { name: 'Macros' }),
      'F3 must open Macros when it is the third tab',
    ).toHaveAttribute('aria-selected', 'true');
    expect(fakeServer.listCommandsReceived(), '2 on Macros must run the second macro').toEqual([
      { type: 'runMacro', macroId: closeTheSessionMacroId },
    ]);
  });

  it('are kept from the browser, so F1 does not open its help', () => {
    // Arrange: the strip.
    renderStrip();

    // Act: press F1.
    const wasLeftToTheBrowser = pressKeyOnThePage('F1');

    // Assert: the press was cancelled for the browser.
    expect(wasLeftToTheBrowser, 'F1 must be kept from the browser').toBe(false);
  });

  it('change nothing past the last tab', () => {
    // Arrange: the strip, on "Box" (three tabs in all).
    renderStrip();
    pressKeyOnThePage('F2');

    // Act: F4, a fourth tab that does not exist.
    pressKeyOnThePage('F4');

    // Assert: still on "Box".
    expect(
      screen.getByRole('tab', { name: 'Box' }),
      'an F-key past the last tab must leave the tab shown as it was',
    ).toHaveAttribute('aria-selected', 'true');
  });
});
