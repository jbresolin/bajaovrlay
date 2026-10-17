/**
 * Camadas: "alterado no ar" and "Salvar no item" (apps/control)
 *
 * What this module is for:
 *   Everything on air comes from an item. When the operator changes an instance in place
 *   ("Atualizar" in "Edição rápida"), the server lists the changed fields on the
 *   instance (`fieldsChangedOnAir`). The Camadas row then says so with the chip "alterado
 *   no ar", whose tooltip names the changed fields by their titles, and offers "Salvar no
 *   item", which keeps the change for the next takes (`saveOnAirChangesIntoItem`). A
 *   change left unsaved is a one-off: the next take shows the item as stored.
 *   A clock's wall-clock moment cannot be saved without a choice, so when it is among the
 *   changed fields "Salvar no item" first asks: "Continuar este relógio" (`keepMoment`)
 *   or "Começar na entrada no ar" (`atTake`).
 *
 * What these tests prove:
 *   - The row of an instance with changed fields shows "alterado no ar", and its tooltip
 *     names those fields by their titles; an instance with none shows no chip.
 *   - "Salvar no item" without a clock moment among the changes sends the command at once,
 *     with `keepMoment` (which then changes nothing).
 *   - With the moment among the changes it asks first; each answer sends its choice, and
 *     "Cancelar" sends nothing.
 *   - An instance whose item was deleted says "item excluído" where the label goes, and
 *     offers no "Salvar no item".
 *
 * What these tests deliberately do not cover:
 *   - Which fields the server lists, and what it writes into the item: apps/server's
 *     updateInstanceDataFieldsChangedOnAir.test.ts and saveOnAirChangesIntoItem.test.ts.
 *   - An instance with no item at all ("sem item"): LayerStatusPanelWithoutItem.test.tsx.
 */
import type { Instance, Item } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEnduranceStartClockItem,
  buildInstanceTakenFromItem,
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

const idOfTheLowerThirdOnAir = 'd2a7f4c9-1e3b-4b58-9c06-8f5e2a1d7b43';
const idOfTheClockOnAir = '9a4c1e7f-3b5d-4e20-8f6a-2c7b9d1e5f38';
const momentOfTheTake = '2026-10-10T13:00:00.000Z';

/** The interview lower third on air, its name and role retyped on air. */
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
    resolvedData: { ...instance.resolvedData, nome: 'Ana Souza Lima', cargo: 'Piloto' },
    fieldsChangedOnAir: ['nome', 'cargo'],
  };
}

/** The start clock on air, retimed on air: its time and its moment are both listed. */
function buildStartClockRetimedOnAir(): Instance {
  const instance = buildInstanceTakenFromItem({
    id: idOfTheClockOnAir,
    item: buildEnduranceStartClockItem(),
    layerId: 'clock',
    target: 'program',
    takenAt: momentOfTheTake,
  });
  return {
    ...instance,
    resolvedData: {
      ...instance.resolvedData,
      referenceTimeMs: 1_800_000,
      referenceWallClockMs: Date.parse(momentOfTheTake),
    },
    fieldsChangedOnAir: ['referenceTimeMs', 'referenceWallClockMs'],
  };
}

/** Draws Camadas on a page holding these items and these instances. */
function renderCamadasWith(items: Item[], instances: Instance[]) {
  return renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    items,
    instances,
  });
}

/** The Camadas row of one layer. */
function findLayerRow(layerName: string) {
  return within(screen.getByRole('listitem', { name: layerName }));
}

describe('the chip "alterado no ar"', () => {
  it('names the changed fields by their titles in its tooltip', async () => {
    // Arrange: the interview lower third with its name and role changed on air.
    renderCamadasWith([buildInterviewLowerThirdItem()], [buildInterviewLowerThirdChangedOnAir()]);

    // Act: reach the chip with the keyboard, which opens its tooltip.
    fireEvent.focus(findLayerRow('Tarja').getByText('alterado no ar'));

    // Assert: the tooltip lists the two fields as the operator knows them.
    await waitFor(() => {
      expect(
        screen.getByRole('tooltip').textContent,
        'the tooltip must name the fields changed on air by their titles',
      ).toContain('Alterado no ar: Nome, Cargo');
    });
  });

  it('is not shown for an instance nothing was changed on', () => {
    // Arrange: the same lower third, as its take left it.
    const lowerThirdAsTaken = buildInterviewLowerThirdChangedOnAir();
    delete lowerThirdAsTaken.fieldsChangedOnAir;

    // Act: draw Camadas.
    renderCamadasWith([buildInterviewLowerThirdItem()], [lowerThirdAsTaken]);

    // Assert: no chip and no "Salvar no item": the air shows the item as stored.
    expect(findLayerRow('Tarja').queryByText('alterado no ar'), 'no change, no chip').toBeNull();
    expect(
      findLayerRow('Tarja').queryByRole('button', { name: 'Salvar no item' }),
      'there is nothing to save',
    ).toBeNull();
  });
});

describe('"Salvar no item"', () => {
  it('saves at once when no clock moment is among the changes', () => {
    // Arrange: the lower third with its name and role changed on air.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewLowerThirdItem()],
      [buildInterviewLowerThirdChangedOnAir()],
    );

    // Act: "Salvar no item" on the lower third's row.
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Salvar no item' }));

    // Assert: one command, no question asked.
    expect(screen.queryByRole('dialog'), 'nothing about a clock needs asking').toBeNull();
    expect(fakeServer.listCommandsReceived(), 'the change must be saved into the item').toEqual([
      {
        type: 'saveOnAirChangesIntoItem',
        instanceId: idOfTheLowerThirdOnAir,
        wallClockFields: 'keepMoment',
      },
    ]);
  });

  const clockChoiceScenarios = [
    // Clearing the clock and bringing it back must show the same race time.
    {
      name: 'saves the clock moment as a fixed number with "Continuar este relógio"',
      answer: 'Continuar este relógio',
      expectedChoice: 'keepMoment',
    },
    // A reusable item: each take starts the clock when it goes on air.
    {
      name: 'saves the clock moment as the moment of each take with "Começar na entrada no ar"',
      answer: 'Começar na entrada no ar',
      expectedChoice: 'atTake',
    },
  ];

  it.each(clockChoiceScenarios)('$name', ({ answer, expectedChoice }) => {
    // Arrange: the start clock retimed on air, and "Salvar no item" pressed.
    const { fakeServer } = renderCamadasWith(
      [buildEnduranceStartClockItem()],
      [buildStartClockRetimedOnAir()],
    );
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Salvar no item' }));
    const commandsBeforeTheAnswer = fakeServer.listCommandsReceived().length;

    // Act: answer the question about the clock.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: answer }));

    // Assert: nothing was sent before the answer; then one command carrying the choice.
    expect(commandsBeforeTheAnswer, 'nothing may be saved before the operator chose').toBe(0);
    expect(fakeServer.listCommandsReceived(), 'the save must carry the choice').toEqual([
      {
        type: 'saveOnAirChangesIntoItem',
        instanceId: idOfTheClockOnAir,
        wallClockFields: expectedChoice,
      },
    ]);
  });

  it('sends nothing when the question about the clock is cancelled', () => {
    // Arrange: the start clock retimed on air, and "Salvar no item" pressed.
    const { fakeServer } = renderCamadasWith(
      [buildEnduranceStartClockItem()],
      [buildStartClockRetimedOnAir()],
    );
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Salvar no item' }));

    // Act: "Cancelar".
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    // Assert: the question is gone and nothing was saved.
    expect(screen.queryByRole('dialog'), 'the question must close').toBeNull();
    expect(fakeServer.listCommandsReceived(), 'a cancelled save sends nothing').toEqual([]);
  });
});

describe('an instance whose item was deleted', () => {
  it('says "item excluído" and offers no "Salvar no item"', () => {
    // Arrange: the lower third changed on air, its item deleted since.
    renderCamadasWith([], [buildInterviewLowerThirdChangedOnAir()]);

    // Act: nothing; the row is drawn as the page opens.

    // Assert: the row names what happened to the item, and has nothing to save into.
    expect(
      findLayerRow('Tarja').getByText('item excluído'),
      'the row must say the item is gone',
    ).toBeVisible();
    expect(
      findLayerRow('Tarja').queryByRole('button', { name: 'Salvar no item' }),
      'there is no item to save into',
    ).toBeNull();
  });
});
