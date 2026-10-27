/**
 * A macro step's layer picker with more than one output (apps/control)
 *
 * What this module is for:
 *   A "Limpar camada" step picks a layer, and since BAJAOVRLAY-49 two outputs may both have
 *   a "Legenda". The step's picker groups the layers by output, program first, as the item
 *   editor's "Camada" does (LayerChoiceOptions), so "Fechar PiP" clears the PiP's caption
 *   and not program's.
 *
 * What these tests prove:
 *   - With program and PiP, "Camada do passo 1" lists "Saída Programa" then "Saída PiP",
 *     each with its layers bottom to top, and choosing the PiP's "Legenda" saves a step
 *     naming the PiP's caption.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the macro editor; MacroEditorPanel.test.tsx.
 *   - The picker with program alone, which the item editor's test covers for both
 *     (ItemEditorPanelLayerOfOutput.test.tsx).
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildPipCaptionLayer,
  buildPipFrameLayer,
} from '@/state/outputsLikeTheServerSends.testSupport';
import { buildSlicesWithShortcutsAndMacros } from '@/state/quickFireLikeTheServerSends.testSupport';

import { MacroEditorPanel } from './MacroEditorPanel';

/** The macro test slices, with the PiP output and its frame and caption added. */
function buildSlicesWithShortcutsMacrosAndThePip() {
  const slices = buildSlicesWithShortcutsAndMacros();
  return {
    ...slices,
    outputs: [...slices.outputs, { outputId: 'pip', name: 'PiP', order: 1 }],
    layers: [...slices.layers, buildPipFrameLayer(), buildPipCaptionLayer()],
  };
}

/** The option names of one group of the open dropdown. */
function readOptionNamesOfGroup(groupName: string): string[] {
  const group = screen.getByRole('group', { name: groupName });
  return within(group)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

describe('"Limpar camada" with program and PiP', () => {
  it("groups the layers by output and saves the PiP's caption", () => {
    // Arrange: the editor for a new macro, with a "Limpar camada" step.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <MacroEditorPanel macroBeingEdited={null} onClose={vi.fn<() => void>()} />,
      buildSlicesWithShortcutsMacrosAndThePip(),
    );
    fireEvent.change(screen.getByLabelText('Rótulo da macro'), { target: { value: 'Fechar PiP' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Passo' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Tipo do passo 1' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Limpar camada' }));

    // Act: open the step's layer picker, read it, choose the PiP's "Legenda", and save.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Camada do passo 1' }), {
      key: 'Enter',
    });
    const groupCount = screen.getAllByRole('group').length;
    const pipOptions = readOptionNamesOfGroup('Saída PiP');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Saída PiP' })).getByRole('option', {
        name: 'Legenda',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));

    // Assert: two groups, the PiP's layers bottom to top, and the PiP's caption saved.
    expect(groupCount, 'one group per output').toBe(2);
    expect(pipOptions, "the PiP's layers, bottom to top").toEqual(['Moldura', 'Legenda']);
    expect(fakeServer.listCommandsReceived(), "the step names the PiP's caption").toEqual([
      expect.objectContaining({
        type: 'createMacro',
        label: 'Fechar PiP',
        steps: [{ kind: 'clearLayer', layerId: 'legenda-pip' }],
      }),
    ]);
  });
});
