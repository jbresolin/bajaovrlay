/**
 * Stopping a running macro: the "Parar" button and the key P (apps/control)
 *
 * What this module is for:
 *   While a macro runs, its button area shows "Parar". A click, or the key P anywhere on
 *   the page (whichever tab of the strip is shown), sends `stopMacro` for the macro that
 *   is running. The server marks the run as being stopped and its runner ends it after
 *   the step in progress; meanwhile the button says "Parando…".
 *
 * What these tests prove:
 *   - "Parar" is drawn only on the running macro, and a click sends stopMacro for it.
 *   - A run being stopped shows "Parando…" in place of the step, and no second "Parar".
 *   - A refused stopMacro is shown at the bottom of the strip, with the other refusals.
 *   - P (and P with Caps Lock) sends stopMacro for the running macro while a panel tab is
 *     shown, not "Macros"; with no macro running it sends nothing; typed in a text field
 *     it is a letter and sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with stopMacro (a wait cut short, the lock freed): the
 *     server's macroRunnerStop.test.ts.
 *   - The rules every shortcut shares (held key, Ctrl/Alt/Meta, the connection):
 *     useKeyboardShortcut.ts holds them once and the rundown's key tests press them.
 *   - That the "?" dialog lists P: KeyboardHelpDialog's test lists every map entry.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildOpenTheSessionBeingStopped,
  buildOpenTheSessionRunningAtTheWait,
  buildSlicesWithShortcutsAndMacros,
  openTheSessionMacroId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { MacroGrid } from './MacroGrid';

/** The moment "Abrir a sessão" was started in these tests. */
const momentTheMacroStarted = '2026-10-17T13:00:00.000Z';

/** The race day with "Abrir a sessão" running, at its wait. */
function buildSlicesWithOpenTheSessionRunning() {
  const slices = buildSlicesWithShortcutsAndMacros();
  slices.macroRuns = [buildOpenTheSessionRunningAtTheWait(momentTheMacroStarted)];
  return slices;
}

/** The list of macro buttons. */
function findMacroList() {
  return within(screen.getByRole('list', { name: 'Macros' }));
}

describe('the "Parar" button', () => {
  it('is drawn only on the running macro, and a click sends stopMacro for it', () => {
    // Arrange: the grid, with "Abrir a sessão" running and "Fechar a sessão" idle.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <MacroGrid />,
      buildSlicesWithOpenTheSessionRunning(),
    );

    // Act: click "Parar" on the running macro.
    fireEvent.click(findMacroList().getByRole('button', { name: 'Parar macro: Abrir a sessão' }));

    // Assert: one stopMacro for it, and no "Parar" on the macro that is not running.
    expect(fakeServer.listCommandsReceived(), '"Parar" must stop the running macro').toEqual([
      { type: 'stopMacro', macroId: openTheSessionMacroId },
    ]);
    expect(
      findMacroList().queryByRole('button', { name: 'Parar macro: Fechar a sessão' }),
      'a macro that is not running has nothing to stop',
    ).not.toBeInTheDocument();
  });

  it('gives way to "Parando…" once the server marked the run as being stopped', () => {
    // Arrange: "Abrir a sessão" at its wait, after a "Parar" the server accepted.
    const slices = buildSlicesWithShortcutsAndMacros();
    slices.macroRuns = [buildOpenTheSessionBeingStopped(momentTheMacroStarted)];

    // Act: draw the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, slices);

    // Assert: the button says "Parando…" instead of the step, and offers no second "Parar".
    expect(
      findMacroList().getByRole('button', { name: /^Abrir a sessão/ }),
      'a run being stopped must say so until it ends',
    ).toHaveTextContent('Parando…');
    expect(
      findMacroList().queryByRole('button', { name: 'Parar macro: Abrir a sessão' }),
      'a run already being stopped needs no second "Parar"',
    ).not.toBeInTheDocument();
  });

  it('shows a refused stopMacro at the bottom of the strip', () => {
    // Arrange: the whole strip on "Macros", with "Abrir a sessão" running.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithOpenTheSessionRunning(),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Macros' }));

    // Act: click "Parar"; the server refuses it (the macro was deleted meanwhile).
    fireEvent.click(findMacroList().getByRole('button', { name: 'Parar macro: Abrir a sessão' }));
    fakeServer.refuseLastCommand({
      code: 'MACRO_NOT_FOUND',
      message: 'A macro "macro-abrir-sessao" não existe.',
    });

    // Assert: the refusal is shown in the strip.
    expect(
      within(screen.getByRole('region', { name: 'Atalhos e macros' })).getByRole('alert'),
      'the server’s refusal must be shown where the strip’s refusals go',
    ).toHaveTextContent('não existe');
  });
});

describe('the key P', () => {
  const keyScenarios = [
    // The key as most keyboards send it.
    { name: 'stops the running macro with p, from a panel tab', key: 'p' },
    // With Caps Lock on, or Shift held, the browser sends the capital letter.
    { name: 'stops the running macro with P (Caps Lock), from a panel tab', key: 'P' },
  ];

  it.each(keyScenarios)('$name', ({ key }) => {
    // Arrange: the whole strip, on its first panel tab ("Atalhos", not "Macros"), with
    // "Abrir a sessão" running.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithOpenTheSessionRunning(),
    );

    // Act: press the key on the page.
    fireEvent.keyDown(document.body, { key });

    // Assert: one stopMacro for the running macro, though its tab is not shown.
    expect(
      fakeServer.listCommandsReceived(),
      'P must stop the running macro whichever tab is shown',
    ).toEqual([{ type: 'stopMacro', macroId: openTheSessionMacroId }]);
  });

  it('sends nothing when no macro is running', () => {
    // Arrange: the whole strip, nothing running.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: press P.
    fireEvent.keyDown(document.body, { key: 'p' });

    // Assert: nothing sent.
    expect(fakeServer.listCommandsReceived(), 'with nothing running P must send nothing').toEqual(
      [],
    );
  });

  it('is a letter, not a shortcut, when typed into a text field', () => {
    // Arrange: the whole strip with a macro running, and the new-panel name field open.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithOpenTheSessionRunning(),
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Painel' }));
    const nameField = screen.getByLabelText('Nome do novo painel');

    // Act: type a p into the field (as in "Patrocinadores").
    fireEvent.keyDown(nameField, { key: 'p' });

    // Assert: nothing sent.
    expect(fakeServer.listCommandsReceived(), 'a p typed in a field must stop nothing').toEqual([]);
  });
});
