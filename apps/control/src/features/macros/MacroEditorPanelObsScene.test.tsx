/**
 * The macro editor's "Trocar cena do OBS" step (apps/control)
 *
 * What this module is for:
 *   A macro can switch OBS's scene as one of its steps (BAJAOVRLAY-27), so one button
 *   changes the scene and puts the graphics for it on air ("Pista + torre"). The editor
 *   offers the step with a picker over the scenes OBS lists (the obs slice), Program or
 *   OBS's Preview, and says that the macro's Prévia does not switch OBS.
 *
 * What these tests prove:
 *   - "Pista + torre" built in the editor sends createMacro with the obsScene step first,
 *     on Program, then the take.
 *   - The scene picker offers OBS's scenes in OBS's order.
 *   - The step says the macro's Prévia leaves OBS alone.
 *   - With OBS not connected (no scene list) the picker says so, and a save is refused
 *     on that step with the reason, sending nothing.
 *
 * What these tests deliberately do not cover:
 *   - Every way a scene row becomes a step: macroStepDrafts.test.ts.
 *   - What the server does with the step: apps/server's obsSceneMacroStep.test.ts.
 */
import { type ObsSlice, obsSliceWithoutObs } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithShortcutsAndMacros,
  enduranceClockItemId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { MacroEditorPanel } from './MacroEditorPanel';

/** OBS on the stream PC, connected, with "Intervalo" on Program. */
const obsConnectedOnRaceDay: ObsSlice = {
  connectionState: 'conectado',
  address: 'ws://127.0.0.1:4455',
  lastError: null,
  sceneNames: ['Pista', 'Box', 'Pódio', 'Intervalo'],
  programSceneName: 'Intervalo',
  isStudioModeOn: false,
  previewSceneName: null,
  sceneSwitch: null,
};

/** Draws the editor for a new macro on a connected page, with OBS as given. */
function renderNewMacroEditorWithObs(obs: ObsSlice) {
  return renderOnControlPageConnectedToFakeServer(
    <MacroEditorPanel macroBeingEdited={null} onClose={vi.fn<() => void>()} />,
    { ...buildSlicesWithShortcutsAndMacros(), obs },
  );
}

/** Opens a dropdown found by its accessible name and picks one of its options. */
function chooseOption(dropdownName: string, optionName: string): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

/** Presses "+ Passo" and gives the new step (number `stepNumber`) its kind. */
function addStepOfKind(stepNumber: number, kindName: string): void {
  fireEvent.click(screen.getByRole('button', { name: '+ Passo' }));
  chooseOption(`Tipo do passo ${stepNumber}`, kindName);
}

describe('the "Trocar cena do OBS" step', () => {
  it('builds "Pista + torre": the scene on Program first, then the take', () => {
    // Arrange: the editor for a new macro, OBS connected.
    const { fakeServer } = renderNewMacroEditorWithObs(obsConnectedOnRaceDay);

    // Act: name it, pick "Pista" for step 1 and the clock item for step 2, save.
    fireEvent.change(screen.getByLabelText('Rótulo da macro'), {
      target: { value: 'Pista + torre' },
    });
    addStepOfKind(1, 'Trocar cena do OBS');
    chooseOption('Cena do OBS do passo 1', 'Pista');
    addStepOfKind(2, 'Pôr item no ar');
    chooseOption('Item do passo 2', 'Relógio do enduro (Atalhos)');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));

    // Assert: the scene step first, on Program.
    expect(fakeServer.listCommandsReceived(), 'the scene must come before the take').toEqual([
      {
        type: 'createMacro',
        label: 'Pista + torre',
        color: 'neutral',
        steps: [
          { kind: 'obsScene', sceneName: 'Pista', target: 'program' },
          { kind: 'takeItem', itemId: enduranceClockItemId },
        ],
      },
    ]);
  });

  it('offers OBS’s scenes in OBS’s order', () => {
    // Arrange: the editor for a new macro, OBS connected, with a scene step.
    renderNewMacroEditorWithObs(obsConnectedOnRaceDay);
    addStepOfKind(1, 'Trocar cena do OBS');

    // Act: open the scene picker.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Cena do OBS do passo 1' }), {
      key: 'Enter',
    });

    // Assert: the four scenes as OBS lists them.
    const sceneOptions = screen.getAllByRole('option').map((option) => option.textContent);
    expect(sceneOptions, 'the picker must list OBS’s scenes in OBS’s order').toEqual([
      'Pista',
      'Box',
      'Pódio',
      'Intervalo',
    ]);
  });

  it('says on the step that the macro’s Prévia leaves OBS alone', () => {
    // Arrange: the editor for a new macro, OBS connected.
    renderNewMacroEditorWithObs(obsConnectedOnRaceDay);

    // Act: add a scene step.
    addStepOfKind(1, 'Trocar cena do OBS');

    // Assert: the note is on that step.
    const stepRow = screen.getByRole('listitem', { name: 'Passo 1' });
    expect(
      within(stepRow).getByText(/não troca a cena do OBS na Prévia/),
      'the step must say the macro’s Prévia does not switch OBS',
    ).toBeVisible();
  });

  it('with OBS not connected, says so in the picker and refuses to save the step', () => {
    // Arrange: the editor for a new macro, no OBS, with a label and a scene step.
    const { fakeServer } = renderNewMacroEditorWithObs({
      ...obsSliceWithoutObs,
      connectionState: 'erro',
      address: 'ws://127.0.0.1:4455',
      lastError: 'A conexão com o OBS caiu. O servidor tenta de novo a cada 5 s.',
    });
    fireEvent.change(screen.getByLabelText('Rótulo da macro'), {
      target: { value: 'Pista + torre' },
    });
    addStepOfKind(1, 'Trocar cena do OBS');

    // Act: try to save.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));

    // Assert: the picker says why it is empty, the step says why it is refused, nothing sent.
    expect(
      screen.getByRole('combobox', { name: 'Cena do OBS do passo 1' }),
      'the picker must say OBS is not connected',
    ).toHaveTextContent('Sem cenas: OBS não conectado');
    expect(
      screen.getByText(
        'O OBS não está conectado, então não há lista de cenas. Conecte o OBS para salvar este passo.',
      ),
      'the step must say why it cannot be saved',
    ).toBeVisible();
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });
});
