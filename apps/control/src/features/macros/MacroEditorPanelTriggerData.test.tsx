/**
 * The macro editor's "Dado do gatilho" on a take step (apps/control)
 *
 * What this module is for:
 *   A macro started by a trigger carries the trigger's data (BAJAOVRLAY-48), and a "Pôr
 *   item no ar" step can fill any of its item's fields from it: "Dado do gatilho › <chave>",
 *   chosen per field under "Campos do gatilho". The value is read once, at that step. Run by
 *   hand the macro has no trigger data, and the editor says what that does.
 *
 * What these tests prove:
 *   - Choosing "Dado do gatilho" for the clock's "Título", key `sessao`, and saving sends
 *     updateMacro whose first step carries triggerFields; the other steps are unchanged.
 *   - The note about a run by hand appears once a field comes from the trigger, not before.
 *   - A stored step that reads the trigger opens with its fields shown and its key filled.
 *
 * What these tests deliberately do not cover:
 *   - Every row the step's fields become; takeStepTriggerFields.test.ts.
 *   - What the server does with the step; apps/server's triggerDataInTakes.test.ts.
 */
import type { Macro } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  bajaLogoItemId,
  buildSlicesWithShortcutsAndMacros,
  buildTwoMacros,
  enduranceClockItemId,
  openTheSessionMacroId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { MacroEditorPanel } from './MacroEditorPanel';

/** The note a take step shows once one of its fields comes from the trigger. */
const byHandNote =
  'Rodada à mão, a macro não tem dado de gatilho: se um campo obrigatório vem do gatilho, a macro para neste passo; um campo opcional fica de fora.';

/** Draws the editor of a stored macro on a connected page. */
function renderTheEditorOf(macro: Macro) {
  return renderOnControlPageConnectedToFakeServer(
    <MacroEditorPanel macroBeingEdited={macro} onClose={vi.fn<() => void>()} />,
    buildSlicesWithShortcutsAndMacros(),
  );
}

/** "Abrir a sessão" as the server holds it: clock, half a second, logo. */
function readOpenTheSessionMacro(): Macro {
  const macro = buildTwoMacros().find((candidate) => candidate.id === openTheSessionMacroId);
  if (macro === undefined) {
    throw new Error('the fixtures lost "Abrir a sessão"');
  }
  return macro;
}

describe('"Dado do gatilho" on a take step', () => {
  it('fills the clock’s title from the trigger’s `sessao`, sending updateMacro', () => {
    // Arrange: "Abrir a sessão" open, the first step's fields shown.
    const { fakeServer } = renderTheEditorOf(readOpenTheSessionMacro());
    fireEvent.click(screen.getByRole('button', { name: 'Campos do gatilho do passo 1' }));
    const noteBeforeChoosing = screen.queryByText(byHandNote);

    // Act: "Título" from the trigger, key `sessao`; save.
    chooseOptionInDropdown('Origem de Título no passo 1', 'Dado do gatilho');
    fireEvent.change(screen.getByLabelText('Chave do gatilho para Título no passo 1'), {
      target: { value: 'sessao' },
    });
    const noteAfterChoosing = screen.queryByText(byHandNote);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));

    // Assert: the note only once a field reads the trigger; the steps with the first filled.
    expect(noteBeforeChoosing, 'no note while every field is the item’s').toBe(null);
    expect(noteAfterChoosing, 'the editor must say what a run by hand does').not.toBe(null);
    expect(fakeServer.listCommandsReceived(), 'the take step carries its trigger field').toEqual([
      {
        type: 'updateMacro',
        macroId: openTheSessionMacroId,
        steps: [
          {
            kind: 'takeItem',
            itemId: enduranceClockItemId,
            triggerFields: { sessionName: { kind: 'triggerData', key: 'sessao' } },
          },
          { kind: 'wait', ms: 500 },
          { kind: 'takeItem', itemId: bajaLogoItemId },
        ],
      },
    ]);
  });

  it('opens a stored step that reads the trigger with its fields shown and its key filled', () => {
    // Arrange: "Abrir a sessão" whose clock already takes its title from `sessao`.
    const macro = readOpenTheSessionMacro();
    const macroReadingTheTrigger: Macro = {
      ...macro,
      steps: [
        {
          kind: 'takeItem',
          itemId: enduranceClockItemId,
          triggerFields: { sessionName: { kind: 'triggerData', key: 'sessao' } },
        },
        ...macro.steps.slice(1),
      ],
    };

    // Act: open it.
    renderTheEditorOf(macroReadingTheTrigger);

    // Assert: the key is there without unfolding anything, and the note with it.
    expect(
      screen.getByLabelText('Chave do gatilho para Título no passo 1'),
      'the step must show the key it reads',
    ).toHaveValue('sessao');
    expect(screen.getByText(byHandNote), 'and what a run by hand does').toBeInTheDocument();
  });
});
