/**
 * Camadas: "Salvar no item" for a stopped clock, while it waits, and when refused
 * (apps/control)
 *
 * What this module is for:
 *   "Salvar no item" keeps a change made on air for the next takes of the item. A clock is
 *   saved whole (time, moment, running, mode, found by their `v_baja.role`), and its
 *   moment needs the operator's choice, so the question comes up whenever any clock field
 *   is among the changes: stopping the clock lists only the running switch, yet saving it
 *   writes the time it stopped at and that moment (gate 2 of PR #15). The button is a
 *   command like any other: off while its answer is on the way, and its refusal shown.
 *
 * What these tests prove:
 *   - A clock stopped on air (only "Relógio correndo" listed) asks the clock question
 *     before anything is saved.
 *   - While "Salvar no item" waits for the server, the button is off, so a second press
 *     sends nothing; it comes back with the answer.
 *   - A refused "Salvar no item" is shown under Camadas, in the server's words.
 *
 * What these tests deliberately do not cover:
 *   - What the server saves for a clock; apps/server's saveOnAirChangesIntoItemClock.test.ts.
 *   - The chip and the other answers to the question: LayerStatusPanelOnAirChanges.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEnduranceStartClockItem,
  buildInstanceTakenFromItem,
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

const idOfTheClockOnAir = '9a4c1e7f-3b5d-4e20-8f6a-2c7b9d1e5f38';
const idOfTheLowerThirdOnAir = 'd2a7f4c9-1e3b-4b58-9c06-8f5e2a1d7b43';
const momentOfTheTake = '2026-10-10T13:00:00.000Z';

/** The start clock on air, stopped on air: only the running switch is listed. */
function buildStartClockStoppedOnAir(): Instance {
  const instance = buildInstanceTakenFromItem({
    id: idOfTheClockOnAir,
    item: buildEnduranceStartClockItem(),
    layerId: 'clock',
    target: 'program',
    takenAt: momentOfTheTake,
  });
  return {
    ...instance,
    resolvedData: { ...instance.resolvedData, running: false },
    fieldsChangedOnAir: ['running'],
  };
}

/** The interview lower third on air, its name retyped on air. */
function buildInterviewLowerThirdChangedOnAir(): Instance {
  const instance = buildInstanceTakenFromItem({
    id: idOfTheLowerThirdOnAir,
    item: buildInterviewLowerThirdItem(),
    layerId: 'lower-third',
    target: 'program',
    takenAt: momentOfTheTake,
  });
  return {
    ...instance,
    resolvedData: { ...instance.resolvedData, nome: 'Ana Souza Lima' },
    fieldsChangedOnAir: ['nome'],
  };
}

/** Draws Camadas with both items and these instances. */
function renderCamadasWith(instances: Instance[]) {
  return renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    items: [buildEnduranceStartClockItem(), buildInterviewLowerThirdItem()],
    instances,
  });
}

/** The Camadas row of one layer. */
function findLayerRow(layerName: string) {
  return within(screen.getByRole('listitem', { name: layerName }));
}

describe('"Salvar no item" of a clock stopped on air', () => {
  it('asks the clock question although only the running switch is listed', () => {
    // Arrange: the start clock stopped on air.
    const { fakeServer } = renderCamadasWith([buildStartClockStoppedOnAir()]);

    // Act: "Salvar no item" on the clock's row.
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Salvar no item' }));

    // Assert: the question is on screen and nothing was saved yet.
    expect(
      screen.getByRole('dialog', { name: 'Como guardar o relógio no item?' }),
      'saving a stopped clock saves its moment too, so the operator must choose first',
    ).toBeVisible();
    expect(fakeServer.listCommandsReceived(), 'nothing may be saved before the answer').toEqual([]);
  });
});

describe('"Salvar no item" while its command waits, and when it is refused', () => {
  it('is off while the save waits, so a second press sends nothing, and comes back with the answer', async () => {
    // Arrange: the lower third changed on air, and "Salvar no item" pressed once.
    const { fakeServer } = renderCamadasWith([buildInterviewLowerThirdChangedOnAir()]);
    const saveButton = findLayerRow('Tarja').getByRole('button', { name: 'Salvar no item' });
    fireEvent.click(saveButton);

    // Act: an impatient second press before the server answered.
    fireEvent.click(saveButton);
    await letThePageFinishWhatItStarted();

    // Assert: one command, the button off while it waits, and on again after the answer
    // (a refusal here, so the row and its button stay).
    expect(fakeServer.listCommandsReceived(), 'a double press must send one save').toHaveLength(1);
    expect(saveButton, 'the button must be off while its command waits').toBeDisabled();
    fakeServer.refuseLastCommand({
      code: 'NOTHING_CHANGED_ON_AIR',
      message:
        'Nada foi alterado no ar desde que o item "Tarja da equipe 42" entrou; não há o que salvar.',
    });
    await waitFor(() => {
      expect(
        findLayerRow('Tarja').getByRole('button', { name: 'Salvar no item' }),
        'the button must come back once the server answered',
      ).toBeEnabled();
    });
  });

  it('shows a refused save under Camadas, in the server’s words', async () => {
    // Arrange: the lower third changed on air, and "Salvar no item" pressed.
    const { fakeServer } = renderCamadasWith([buildInterviewLowerThirdChangedOnAir()]);
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Salvar no item' }));

    // Act: another operator deleted the item a moment before, and the server refuses.
    fakeServer.refuseLastCommand({
      code: 'ITEM_NOT_FOUND',
      message:
        'O item "5e1a9c73-2b64-4f08-b3d1-7a9e0c6d8f25" não existe; ele pode ter sido excluído.',
    });

    // Assert: the refusal is shown below the layers.
    expect(
      await screen.findByRole('alert'),
      'the operator must be told why the change was not saved',
    ).toHaveTextContent('ele pode ter sido excluído');
  });
});
