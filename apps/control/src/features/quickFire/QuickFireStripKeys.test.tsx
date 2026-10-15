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
 *   - With a button's "⋯" menu open and the focus in it, the page's keys are left to the
 *     menu: a digit, Backspace, → and ← send nothing, and the Esc that closes the menu
 *     does not arm "Limpar tudo" (these rows draw the whole page, so every key has
 *     something it would otherwise do).
 *
 * What these tests deliberately do not cover:
 *   - The rules every shortcut shares (Ctrl/Alt/Meta, a key used by another control,
 *     the connection): useKeyboardShortcut.ts holds them once, and the rundown's key
 *     tests (RundownPanelKeyboard.test.tsx) press them.
 *   - Which button a digit reaches in edge cases: quickFireTabs.test.ts.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/App';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildRaceClockPreviewOfItem } from '@/state/previewLikeTheServerSends.testSupport';
import {
  bajaLogoItemId,
  buildSlicesWithShortcutsAndMacros,
  closeTheSessionMacroId,
  redFlagItemId,
} from '@/state/quickFireLikeTheServerSends.testSupport';
import { buildMainRundown, yellowFlagItemId } from '@/state/rundownLikeTheServerSends.testSupport';

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

/**
 * Draws the whole page with the three buttons of "Atalhos", the rundown's cursor on the
 * yellow flag (so both arrows have somewhere to go) and a clock on the preview output
 * (so Backspace has a preview to discard): every key below WOULD send a command from the
 * page itself. Then opens the "⋯" menu of "Logo Baja" and hands back its "Editar".
 */
function renderPageWithTheMenuOfLogoBajaOpen() {
  const slices = buildSlicesWithShortcutsAndMacros();
  slices.rundowns = [buildMainRundown(yellowFlagItemId)];
  slices.instances.push(buildRaceClockPreviewOfItem(yellowFlagItemId, '2026-10-17T13:05:00.000Z'));
  const rendered = renderOnControlPageConnectedToFakeServer(<App />, slices);
  // Radix opens its menu on a pointer press or on Enter; Enter needs no pointer stand-in.
  fireEvent.keyDown(screen.getByRole('button', { name: 'Mais ações: Logo Baja' }), {
    key: 'Enter',
  });
  return { ...rendered, editMenuItem: screen.getByRole('menuitem', { name: 'Editar' }) };
}

describe('the page’s keys while a button’s "⋯" menu has the focus', () => {
  const keysThatBelongToTheMenu = [
    // A digit is the menu's type-to-find; it must not take the third button.
    { name: 'the digit 3 takes nothing', key: '3' },
    // Backspace must not discard the preview the operator is looking at.
    { name: 'Backspace discards no preview', key: 'Backspace' },
    // The arrows move inside a menu; they must not move the rundown's cursor.
    { name: '→ moves no cursor', key: 'ArrowRight' },
    { name: '← moves no cursor', key: 'ArrowLeft' },
  ];

  it.each(keysThatBelongToTheMenu)('$name', ({ key }) => {
    // Arrange: the page, with the menu of "Logo Baja" open and the focus in it.
    const { fakeServer, editMenuItem } = renderPageWithTheMenuOfLogoBajaOpen();

    // Act: press the key of this row on the menu's "Editar".
    fireEvent.keyDown(editMenuItem, { key });

    // Assert: nothing was sent; the operator is choosing in the menu.
    expect(
      fakeServer.listCommandsReceived(),
      'a key pressed inside an open menu must not act on the page',
    ).toEqual([]);
  });

  it('closes the menu with Esc without arming "Limpar tudo"', () => {
    // Arrange: the page, with the menu of "Logo Baja" open and the focus in it.
    renderPageWithTheMenuOfLogoBajaOpen();

    // Act: press Esc on the menu's "Editar".
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Editar' }), { key: 'Escape' });

    // Assert: the menu is closed and "Limpar tudo" is not waiting for a confirmation.
    expect(screen.queryByRole('menu'), 'Esc must close the open menu').toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Confirmar: limpar tudo' }),
      'the Esc that closes a menu must not arm "Limpar tudo"',
    ).toBeNull();
  });
});
