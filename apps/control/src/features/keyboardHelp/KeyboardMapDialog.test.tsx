/**
 * The "?" dialog: every keyboard shortcut on one screen (apps/control)
 *
 * What this module is for:
 *   The "?" button in the page header opens a dialog that lists every shortcut of the
 *   page: the key, what it does and when it works. The list is generated from
 *   src/keyboard/keyboardMap.ts, the same entries the listeners read, so the help cannot
 *   say something the keys do not do.
 *
 * What these tests prove:
 *   - "?" opens the dialog "Atalhos do teclado", and every entry of the map appears in
 *     it with its key name, its description and its condition, in the map's order.
 *   - Esc closes the dialog without arming "Limpar tudo" (the dialog uses that press),
 *     and the next Esc arms "Limpar tudo" as always.
 *
 * What these tests deliberately do not cover:
 *   - The rules of each key: keyboardMap.test.ts and the tests that press them.
 *   - The dialog's look; it is shadcn's, checked by eye in the browser.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClearAllButton } from '@/features/playout/ClearAllButton';
import { listKeyboardShortcutsInDialogOrder } from '@/keyboard/keyboardMap';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { KeyboardMapDialog } from './KeyboardMapDialog';

/** The header's "?" next to "Limpar tudo", on a connected page. */
function renderHelpButtonBesideClearAll() {
  return renderOnControlPageConnectedToFakeServer(
    <div>
      <KeyboardMapDialog />
      <ClearAllButton />
    </div>,
    buildSlicesWithNothingOnAir(),
  );
}

describe('the "?" dialog', () => {
  it('lists every shortcut of the keyboard map, in its order', () => {
    // Arrange: the "?" button on the page.
    renderHelpButtonBesideClearAll();

    // Act: press "?".
    fireEvent.click(screen.getByRole('button', { name: 'Atalhos do teclado' }));

    // Assert: one row per entry of the map, each with its key, description and condition.
    const dialog = within(screen.getByRole('dialog', { name: 'Atalhos do teclado' }));
    const shortcutRows = dialog.getAllByRole('row').slice(1);
    const shortcutsOfTheMap = listKeyboardShortcutsInDialogOrder();
    expect(shortcutRows, 'the dialog must have exactly one row per shortcut').toHaveLength(
      shortcutsOfTheMap.length,
    );
    shortcutsOfTheMap.forEach((shortcut, position) => {
      const row = within(shortcutRows[position] as HTMLElement);
      expect(
        row.getByText(shortcut.keyName),
        `row ${position + 1} must name the key "${shortcut.keyName}"`,
      ).toBeInTheDocument();
      expect(
        row.getByText(shortcut.description),
        `row ${position + 1} must say what "${shortcut.keyName}" does`,
      ).toBeInTheDocument();
      expect(
        row.getByText(shortcut.condition),
        `row ${position + 1} must say when "${shortcut.keyName}" works`,
      ).toBeInTheDocument();
    });
  });

  it('closes with Esc without arming "Limpar tudo", and the next Esc arms it', () => {
    // Arrange: the dialog open.
    const { fakeServer } = renderHelpButtonBesideClearAll();
    fireEvent.click(screen.getByRole('button', { name: 'Atalhos do teclado' }));
    const dialog = screen.getByRole('dialog', { name: 'Atalhos do teclado' });

    // Act: Esc in the dialog, then Esc again on the page.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    const isDialogStillOpen = screen.queryByRole('dialog') !== null;
    const clearAllTextAfterTheFirstEsc = screen.getByRole('button', {
      name: /limpar tudo/i,
    }).textContent;
    fireEvent.keyDown(document.body, { key: 'Escape' });

    // Assert: the first Esc only closed the dialog; the second armed "Limpar tudo"; no
    // clearAll was sent by either.
    expect(isDialogStillOpen, 'Esc must close the dialog').toBe(false);
    expect(
      clearAllTextAfterTheFirstEsc,
      'the Esc that closes the dialog must not arm "Limpar tudo"',
    ).toBe('Limpar tudo');
    expect(
      screen.getByRole('button', { name: 'Confirmar: limpar tudo' }),
      'once the dialog is closed, Esc must arm "Limpar tudo" as always',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'neither Esc may clear anything').toEqual([]);
  });
});
