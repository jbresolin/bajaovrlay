/**
 * A macro button's "⋯" menu and tooltip (apps/control)
 *
 * What this module is for:
 *   A macro button runs its macro on a click. Its small "⋯" (or a right-click on the
 *   button) opens a menu with "Executar" (`runMacro`, the macro with its waits),
 *   "Prévia" (`previewMacro`: the screen as it will be when the macro has ended, on the
 *   preview output only) and "Editar" (the macro editor). Because "Prévia" then "Tomar
 *   tudo" is not the same as "Executar", the button carries a tooltip saying so.
 *
 * What these tests prove:
 *   - The menu offers "Executar", "Prévia" and "Editar", in that order, and a right-click
 *     on the button opens it.
 *   - "Executar" sends `runMacro` and "Prévia" sends `previewMacro` for that macro.
 *   - The button's tooltip reads "Prévia mostra o resultado final; Tomar tudo aplica sem
 *     as esperas".
 *   - A refused `previewMacro` shows the server's pt-BR message at the bottom of the strip.
 *
 * What these tests deliberately do not cover:
 *   - "Editar" opening the editor, the click that runs, and the running badge:
 *     MacroGrid.test.tsx. "Parar": MacroStop.test.tsx.
 *   - What the server does with `previewMacro`: its reducer tests.
 *   - "Tomar tudo", which applies the previewed end state: features/outputMonitors.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithShortcutsAndMacros,
  openTheSessionMacroId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { MacroGrid } from './MacroGrid';

/** Opens the "⋯" menu of one macro, as a keyboard user does (Enter on the "⋯"). */
function openMoreActionsMenuOfMacro(macroLabel: string): void {
  // Radix opens its menu on a pointer press or on Enter; Enter needs no pointer stand-in.
  fireEvent.keyDown(screen.getByRole('button', { name: `Mais ações da macro: ${macroLabel}` }), {
    key: 'Enter',
  });
}

/** The button that runs one macro, found by the label it starts with. */
function findMacroButton(macroLabel: string): HTMLElement {
  return within(screen.getByRole('list', { name: 'Macros' })).getByRole('button', {
    name: new RegExp(`^${macroLabel}`),
  });
}

describe('the "⋯" menu of a macro button', () => {
  it('opens on a right-click of the button with "Executar", "Prévia" and "Editar"', () => {
    // Arrange: the grid with "Abrir a sessão" and "Fechar a sessão".
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <MacroGrid />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: right-click "Abrir a sessão".
    fireEvent.contextMenu(findMacroButton('Abrir a sessão'));

    // Assert: the three actions, in order, and the right-click ran nothing.
    expect(
      screen.getAllByRole('menuitem').map((menuEntry) => menuEntry.textContent),
      'the menu must offer the three actions of a macro',
    ).toEqual(['Executar', 'Prévia', 'Editar']);
    expect(fakeServer.listCommandsReceived(), 'a right-click must not run the macro').toEqual([]);
  });

  // Each row is one entry of the menu and the one command it must send.
  const menuEntryScenarios = [
    // "Executar" is the click of the button, offered in the menu too: the macro with its waits.
    {
      name: '"Executar" sends runMacro',
      menuEntry: 'Executar',
      expectedCommand: { type: 'runMacro', macroId: openTheSessionMacroId },
    },
    // "Prévia" shows the macro's end state on the preview output, program untouched.
    {
      name: '"Prévia" sends previewMacro',
      menuEntry: 'Prévia',
      expectedCommand: { type: 'previewMacro', macroId: openTheSessionMacroId },
    },
  ];

  it.each(menuEntryScenarios)('$name for that macro', ({ menuEntry, expectedCommand }) => {
    // Arrange: the grid, with the "⋯" menu of "Abrir a sessão" open.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <MacroGrid />,
      buildSlicesWithShortcutsAndMacros(),
    );
    openMoreActionsMenuOfMacro('Abrir a sessão');

    // Act: choose the entry of this row.
    fireEvent.click(screen.getByRole('menuitem', { name: menuEntry }));

    // Assert: exactly the one command of this row, for "Abrir a sessão".
    expect(
      fakeServer.listCommandsReceived(),
      'the menu entry must send its one command for that macro',
    ).toEqual([expectedCommand]);
  });
});

describe('the tooltip of a macro button', () => {
  it('says that Prévia shows the end state and Tomar tudo applies it without the waits', async () => {
    // Arrange: the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, buildSlicesWithShortcutsAndMacros());

    // Act: reach "Abrir a sessão" with the keyboard, which opens its tooltip as a mouse
    // resting on it does.
    fireEvent.focus(findMacroButton('Abrir a sessão'));

    // Assert: the tooltip's words, exactly.
    expect(
      await screen.findByRole('tooltip'),
      'the tooltip must tell "Prévia" + "Tomar tudo" apart from "Executar"',
    ).toHaveTextContent('Prévia mostra o resultado final; Tomar tudo aplica sem as esperas');
  });
});

describe('a refused macro Prévia', () => {
  it('shows the server’s message at the bottom of the strip', () => {
    // Arrange: the whole strip on "Macros", and "Prévia" of "Abrir a sessão" sent.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithShortcutsAndMacros(),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Macros' }));
    openMoreActionsMenuOfMacro('Abrir a sessão');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Prévia' }));

    // Act: the server refuses it, because a step's item was deleted.
    fakeServer.refuseLastCommand({
      code: 'ITEM_NOT_FOUND',
      message: 'O passo 3 da macro "Abrir a sessão" usa um item que não existe mais.',
    });

    // Assert: the message is in the strip, where the macro buttons are.
    expect(
      within(screen.getByRole('region', { name: 'Atalhos e macros' })).getByRole('alert'),
      'a refused macro preview must be explained in the strip',
    ).toHaveTextContent('O passo 3 da macro "Abrir a sessão" usa um item que não existe mais.');
  });
});
