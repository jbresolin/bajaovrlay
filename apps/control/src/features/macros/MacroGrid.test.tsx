/**
 * The "Macros" tab: the grid of macro buttons and their running state (apps/control)
 *
 * What this module is for:
 *   The last tab of the quick-fire strip lists the macros as buttons painted in their
 *   colour. A click sends `runMacro`; the server's runner then applies the steps one by
 *   one. While a run is listed in the `macroRuns` slice, that macro's button says so and
 *   which step it is on ("Rodando 2/3"). "+ Macro" and each button's "Editar" open the
 *   macro editor.
 *
 * What these tests prove:
 *   - The macros are listed in the server's order, each with its label and colour.
 *   - A click sends `runMacro` for that macro.
 *   - A running macro shows "Rodando" with its step as "step / steps", counted from 1.
 *   - While a macro runs, the other buttons still send: the server refuses with
 *     MACRO_RUNNING and its pt-BR message is shown in the strip, so a page that missed
 *     the end of a run never blocks the operator.
 *   - With no macro the tab says how to make the first one.
 *   - "+ Macro" opens the editor for a new macro and "Editar" for that macro.
 *
 * What these tests deliberately do not cover:
 *   - The editor itself: MacroEditorPanel.test.tsx.
 *   - The runner (order, waits, a failing step): the server's macroRunner.test.ts.
 *   - The digits on this tab: QuickFireStripKeys.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildOpenTheSessionRunningAtTheWait,
  buildSlicesWithShortcutsAndMacros,
  closeTheSessionMacroId,
  openTheSessionMacroId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { MacroGrid } from './MacroGrid';

/** The moment "Abrir a sessão" was started in the running tests. */
const momentTheMacroStarted = '2026-10-17T13:00:00.000Z';

/** The list of macro buttons. */
function findMacroList() {
  return within(screen.getByRole('list', { name: 'Macros' }));
}

describe('the macros grid', () => {
  it('lists the macros in the server’s order with their label and colour', () => {
    // Arrange: "Abrir a sessão" (green) and "Fechar a sessão" (red).
    const slices = buildSlicesWithShortcutsAndMacros();

    // Act: draw the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, slices);

    // Assert: both, in order, each in its colour.
    const macroRows = findMacroList().getAllByRole('listitem');
    expect(
      macroRows.map((row) => row.getAttribute('aria-label')),
      'the macros must be listed in the order the server sends them',
    ).toEqual(['Abrir a sessão', 'Fechar a sessão']);
    expect(
      findMacroList().getByRole('button', { name: /^Abrir a sessão/ }),
      'a macro button must be painted in its colour',
    ).toHaveAttribute('data-item-color', 'success');
  });

  it('sends runMacro when a macro button is clicked', () => {
    // Arrange: the grid.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <MacroGrid />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: click "Abrir a sessão".
    fireEvent.click(findMacroList().getByRole('button', { name: /^Abrir a sessão/ }));

    // Assert: one runMacro for it.
    expect(fakeServer.listCommandsReceived(), 'a click must run that macro').toEqual([
      { type: 'runMacro', macroId: openTheSessionMacroId },
    ]);
  });

  it('shows the running macro and the step it is on', () => {
    // Arrange: "Abrir a sessão" running, at its second step of three (the wait).
    const slices = buildSlicesWithShortcutsAndMacros();
    slices.macroRuns = [buildOpenTheSessionRunningAtTheWait(momentTheMacroStarted)];

    // Act: draw the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, slices);

    // Assert: "Rodando 2/3" on that button only, and it is marked busy.
    const runningButton = findMacroList().getByRole('button', { name: /^Abrir a sessão/ });
    expect(runningButton, 'the running macro must say so and name its step').toHaveTextContent(
      'Rodando 2/3',
    );
    expect(runningButton, 'the running macro must be marked busy').toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(
      findMacroList().getByRole('button', { name: /^Fechar a sessão/ }),
      'a macro that is not running must not say "Rodando"',
    ).not.toHaveTextContent('Rodando');
  });

  it('still sends another macro while one runs, and shows the server’s refusal', () => {
    // Arrange: the whole strip on "Macros", with "Abrir a sessão" running.
    const slices = buildSlicesWithShortcutsAndMacros();
    slices.macroRuns = [buildOpenTheSessionRunningAtTheWait(momentTheMacroStarted)];
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<QuickFireStrip />, slices);
    fireEvent.click(screen.getByRole('tab', { name: 'Macros' }));

    // Act: click "Fechar a sessão", and the server refuses it.
    fireEvent.click(findMacroList().getByRole('button', { name: /^Fechar a sessão/ }));
    fakeServer.refuseLastCommand({
      code: 'MACRO_RUNNING',
      message: 'A macro "Abrir a sessão" ainda está rodando. Espere ela terminar.',
    });

    // Assert: the run was sent, and the refusal is shown in the strip.
    expect(
      fakeServer.listCommandsReceived(),
      'the button must still send, so a page that missed the end of a run never blocks',
    ).toEqual([{ type: 'runMacro', macroId: closeTheSessionMacroId }]);
    expect(
      within(screen.getByRole('region', { name: 'Atalhos e macros' })).getByRole('alert'),
      'the server’s refusal must be shown in the strip',
    ).toHaveTextContent('ainda está rodando');
  });

  it('says how to make the first macro when there is none', () => {
    // Arrange: no macros.
    const slices = buildSlicesWithShortcutsAndMacros();
    slices.macros = [];

    // Act: draw the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, slices);

    // Assert: the hint.
    expect(
      screen.getByText('Nenhuma macro. Use "+ Macro" para criar a primeira.'),
      'an empty tab must say how to make a macro',
    ).toBeVisible();
  });

  it('opens the macro editor for a new macro with "+ Macro"', () => {
    // Arrange: the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, buildSlicesWithShortcutsAndMacros());

    // Act: "+ Macro".
    fireEvent.click(screen.getByRole('button', { name: '+ Macro' }));

    // Assert: the editor, empty, for a new macro.
    const editor = within(screen.getByRole('region', { name: 'Editor de macro' }));
    expect(
      editor.getByRole('heading', { level: 3 }),
      '"+ Macro" must open the editor for a new macro',
    ).toHaveTextContent('Nova macro');
    expect(editor.getByLabelText('Rótulo da macro'), 'a new macro starts unnamed').toHaveValue('');
  });

  it('opens the macro editor for a macro with its "Editar"', () => {
    // Arrange: the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, buildSlicesWithShortcutsAndMacros());

    // Act: "Editar" of "Fechar a sessão".
    fireEvent.click(screen.getByRole('button', { name: 'Editar macro: Fechar a sessão' }));

    // Assert: the editor shows that macro.
    const editor = within(screen.getByRole('region', { name: 'Editor de macro' }));
    expect(
      editor.getByRole('heading', { level: 3 }),
      '"Editar" must open the editor for that macro',
    ).toHaveTextContent('Editar macro');
    expect(
      editor.getByLabelText('Rótulo da macro'),
      'the editor must be filled with that macro',
    ).toHaveValue('Fechar a sessão');
  });
});
