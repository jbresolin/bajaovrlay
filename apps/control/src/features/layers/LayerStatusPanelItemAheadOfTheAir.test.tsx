/**
 * Camadas: "item mudou", "Disparar" and "Atualizar no ar" (apps/control)
 *
 * What this module is for:
 *   An item saved after its graphic was taken leaves the air behind it: the lower third on
 *   air still says "Ana Souza" while the item now says "Ana Souza Lima". The Camadas row
 *   then carries the chip "item mudou", whose tooltip names the fields behind by their
 *   titles, and offers two ways to catch up: "Disparar" takes the item again (the normal
 *   take), and "Atualizar no ar" sends only those fields to the instance on air
 *   (`updateInstanceData`), so the graphic changes in place. A clock field among them first
 *   asks the clock question "Salvar no item" asks. It is the reverse of "alterado no ar".
 *
 * What these tests prove:
 *   - The chip and its tooltip, its absence when the air matches the item or the item was
 *     deleted, and that it leaves the fields changed on air to "alterado no ar".
 *   - "Atualizar no ar" sends only the fields behind, with the item's values; "Disparar"
 *     sends the take of the item.
 *   - With a clock field behind, "Atualizar no ar" asks first: "Continuar este relógio"
 *     sends the fields as they are, "Começar na entrada no ar" also has the server stamp
 *     the clock's moment, and "Cancelar" sends nothing.
 *   - The chip goes away once the air matches the item.
 *   - A refused "Atualizar no ar" says why on its own row, and a refused update sent from
 *     elsewhere ("Edição rápida", the item editor) is not shown here.
 *   - A layer's preview behind its item gets the chip beside "em prévia" and "Atualizar
 *     prévia", and no "Disparar".
 *
 * What these tests deliberately do not cover:
 *   - Which fields count as behind, case by case: packages/shared itemAheadOfTheAir.test.ts.
 *   - That a source poll redraws nothing: LayerStatusPanelItemAheadOfTheAirRedraws.test.tsx.
 *   - The graphic changing on screen: apps/control's itemAheadOfTheAir.e2e.ts.
 */
import type { Instance, Item } from '@bajaovrlay/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
const idOfTheLowerThirdInPreview = '6c1e8b3a-5d27-4f90-a4e6-1b9d0c7f2e58';
const idOfTheClockOnAir = '9a4c1e7f-3b5d-4e20-8f6a-2c7b9d1e5f38';
const momentOfTheTake = '2026-10-10T13:00:00.000Z';

/** The interview item after the take: her full name and her new role saved into it. */
function buildInterviewItemSavedAfterTheTake(): Item {
  const item = buildInterviewLowerThirdItem();
  return {
    ...item,
    fields: {
      ...item.fields,
      nome: { kind: 'literal', value: 'Ana Souza Lima' },
      cargo: { kind: 'literal', value: 'Piloto' },
    },
  };
}

/** The interview lower third on this output, as its take put it there (before the save). */
function buildInterviewLowerThirdAsTaken(target: 'program' | 'preview'): Instance {
  return buildInstanceTakenFromItem({
    id: target === 'program' ? idOfTheLowerThirdOnAir : idOfTheLowerThirdInPreview,
    item: buildInterviewLowerThirdItem(),
    layerId: 'lower-third',
    target,
    takenAt: momentOfTheTake,
  });
}

/** The endurance start item after the take, restarting from 180:00 instead of 240:00. */
function buildEnduranceStartItemRetimedAfterTheTake(): Item {
  const item = buildEnduranceStartClockItem();
  return {
    ...item,
    fields: { ...item.fields, referenceTimeMs: { kind: 'literal', value: 10_800_000 } },
  };
}

/** The endurance start clock on air as its take put it there, from 240:00. */
function buildEnduranceStartClockAsTaken(): Instance {
  const instance = buildInstanceTakenFromItem({
    id: idOfTheClockOnAir,
    item: buildEnduranceStartClockItem(),
    layerId: 'clock',
    target: 'program',
    takenAt: momentOfTheTake,
  });
  return {
    ...instance,
    resolvedData: { ...instance.resolvedData, referenceWallClockMs: Date.parse(momentOfTheTake) },
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

describe('the chip "item mudou"', () => {
  it('names the fields behind the item by their titles in its tooltip', async () => {
    // Arrange: the lower third on air, its item saved with a new name and role since.
    renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('program')],
    );

    // Act: reach the chip with the keyboard, which opens its tooltip.
    fireEvent.focus(findLayerRow('Tarja').getByText('item mudou'));

    // Assert: the tooltip lists the two fields as the operator knows them.
    await waitFor(() => {
      expect(
        screen.getByRole('tooltip').textContent,
        'the tooltip must name the fields the item changed by their titles',
      ).toContain('Item mudou: Nome, Cargo');
    });
  });

  it('is not shown when the air shows what the item holds', () => {
    // Arrange and act: the lower third on air as its unchanged item gives it.
    renderCamadasWith(
      [buildInterviewLowerThirdItem()],
      [buildInterviewLowerThirdAsTaken('program')],
    );

    // Assert: no chip, no button to catch up.
    expect(findLayerRow('Tarja').queryByText('item mudou'), 'nothing is behind').toBeNull();
    expect(
      findLayerRow('Tarja').queryByRole('button', { name: 'Atualizar no ar' }),
      'there is nothing to send',
    ).toBeNull();
  });

  it('is not shown for an instance whose item was deleted, which keeps "item excluído"', () => {
    // Arrange and act: the lower third on air, its item deleted since.
    renderCamadasWith([], [buildInterviewLowerThirdAsTaken('program')]);

    // Assert: the row says the item is gone, and claims nothing about it.
    expect(findLayerRow('Tarja').getByText('item excluído'), 'the item is gone').toBeVisible();
    expect(findLayerRow('Tarja').queryByText('item mudou'), 'no item, no chip').toBeNull();
  });

  it('leaves a field changed on air to "alterado no ar"', async () => {
    // Arrange: the name retyped on air AND saved anew in the item; the role saved only.
    const instance = buildInterviewLowerThirdAsTaken('program');
    const instanceWithTheNameRetyped: Instance = {
      ...instance,
      resolvedData: { ...instance.resolvedData, nome: 'Ana S.' },
      fieldsChangedOnAir: ['nome'],
    };
    renderCamadasWith([buildInterviewItemSavedAfterTheTake()], [instanceWithTheNameRetyped]);

    // Act: open the tooltip of "item mudou".
    fireEvent.focus(findLayerRow('Tarja').getByText('item mudou'));

    // Assert: both marks are there, and "item mudou" names the role alone.
    expect(findLayerRow('Tarja').getByText('alterado no ar'), 'the name is the air').toBeVisible();
    await waitFor(() => {
      expect(
        screen.getByRole('tooltip').textContent,
        'the two marks must never name the same field',
      ).toBe('Item mudou: Cargo');
    });
  });
});

describe('"Atualizar no ar" and "Disparar" on a row behind its item', () => {
  it('"Atualizar no ar" sends only the fields behind, with the item values', () => {
    // Arrange: the lower third on air, its item saved with a new name and role since.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('program')],
    );

    // Act: "Atualizar no ar" on the lower third's row.
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Atualizar no ar' }));

    // Assert: one update of that instance, with the two fields and nothing else.
    expect(fakeServer.listCommandsReceived(), 'only the changed fields go on air').toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheLowerThirdOnAir,
        data: { nome: 'Ana Souza Lima', cargo: 'Piloto' },
        takeTimeFieldKeys: [],
      },
    ]);
  });

  it('"Disparar" takes the item again, the normal take', () => {
    // Arrange: the lower third on air, its item saved with a new name and role since.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('program')],
    );

    // Act: "Disparar" on the lower third's row.
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Disparar' }));

    // Assert: the take of the item, as the rundown sends it.
    expect(fakeServer.listCommandsReceived(), 'the item must be taken again').toEqual([
      { type: 'takeItem', itemId: buildInterviewLowerThirdItem().id },
    ]);
  });

  it('takes the chip away once the air matches the item', () => {
    // Arrange: the lower third behind its item, its chip on the row.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('program')],
    );
    const chipBefore = findLayerRow('Tarja').queryByText('item mudou');

    // Act: the server sends the instance after the update, showing the item's values.
    const instance = buildInterviewLowerThirdAsTaken('program');
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [
        {
          ...instance,
          resolvedData: { ...instance.resolvedData, nome: 'Ana Souza Lima', cargo: 'Piloto' },
        },
      ],
    });

    // Assert: the chip was there, and is gone.
    expect(chipBefore, 'the chip must be there before the update').not.toBeNull();
    expect(findLayerRow('Tarja').queryByText('item mudou'), 'the air caught up').toBeNull();
  });
});

describe('"Atualizar no ar" with a clock field behind', () => {
  const clockChoiceScenarios = [
    // The clock on air keeps counting from its own moment; the server's clock rule makes
    // the item's time true now, without a jump.
    {
      name: 'sends the time alone with "Continuar este relógio"',
      answer: 'Continuar este relógio',
      expectedTakeTimeFieldKeys: [],
    },
    // The clock starts from the item's time now, as a take would start it.
    {
      name: 'has the server stamp the moment too with "Começar na entrada no ar"',
      answer: 'Começar na entrada no ar',
      expectedTakeTimeFieldKeys: ['referenceWallClockMs'],
    },
  ];

  it.each(clockChoiceScenarios)('$name', ({ answer, expectedTakeTimeFieldKeys }) => {
    // Arrange: the start clock on air from 240:00, its item retimed to 180:00, and
    // "Atualizar no ar" pressed.
    const { fakeServer } = renderCamadasWith(
      [buildEnduranceStartItemRetimedAfterTheTake()],
      [buildEnduranceStartClockAsTaken()],
    );
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Atualizar no ar' }));
    const commandsBeforeTheAnswer = fakeServer.listCommandsReceived().length;

    // Act: answer the question about the clock.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: answer }));

    // Assert: nothing before the answer; then the time, stamped or not as chosen.
    expect(commandsBeforeTheAnswer, 'nothing may be sent before the operator chose').toBe(0);
    expect(fakeServer.listCommandsReceived(), 'the update must carry the choice').toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheClockOnAir,
        data: { referenceTimeMs: 10_800_000 },
        takeTimeFieldKeys: expectedTakeTimeFieldKeys,
      },
    ]);
  });

  it('sends nothing when the question about the clock is cancelled', () => {
    // Arrange: the clock behind its item, and "Atualizar no ar" pressed.
    const { fakeServer } = renderCamadasWith(
      [buildEnduranceStartItemRetimedAfterTheTake()],
      [buildEnduranceStartClockAsTaken()],
    );
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Atualizar no ar' }));

    // Act: "Cancelar".
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    // Assert: the question is gone and nothing was sent.
    expect(screen.queryByRole('dialog'), 'the question must close').toBeNull();
    expect(fakeServer.listCommandsReceived(), 'a cancelled update sends nothing').toEqual([]);
  });

  it('asks nothing when no clock field is behind', () => {
    // Arrange: the clock on air, its item given the leader's seven laps only.
    const item = buildEnduranceStartClockItem();
    const itemWithSevenLaps: Item = {
      ...item,
      fields: { ...item.fields, lapsCompletedByLeader: { kind: 'literal', value: 7 } },
    };
    const { fakeServer } = renderCamadasWith(
      [itemWithSevenLaps],
      [buildEnduranceStartClockAsTaken()],
    );

    // Act: "Atualizar no ar".
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Atualizar no ar' }));

    // Assert: no question, the laps sent at once.
    expect(screen.queryByRole('dialog'), 'the laps say nothing about the clock').toBeNull();
    expect(fakeServer.listCommandsReceived(), 'the laps go on air at once').toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheClockOnAir,
        data: { lapsCompletedByLeader: 7 },
        takeTimeFieldKeys: [],
      },
    ]);
  });
});

describe('a refused "Atualizar no ar"', () => {
  it('shows its own refusal on the row', async () => {
    // Arrange: the lower third behind its item, and "Atualizar no ar" pressed.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('program')],
    );
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Atualizar no ar' }));

    // Act: the server refuses the update.
    fakeServer.refuseLastCommand({
      code: 'INSTANCE_NOT_FOUND',
      message: 'Este gráfico não está mais no ar.',
    });

    // Assert: the refusal is said on the row that sent it.
    await waitFor(() => {
      expect(
        findLayerRow('Tarja').getByRole('alert').textContent,
        'the operator must see why the update did not happen',
      ).toBe('Este gráfico não está mais no ar.');
    });
  });

  it('does not show a refused update another part of the page sent', async () => {
    // Arrange: the lower third behind its item, on a page whose store will hear a refusal.
    const { serverStateStore } = renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('program')],
    );

    // Act: an update sent from "Edição rápida" is refused.
    act(() => {
      serverStateStore.setState({
        lastCommandError: {
          commandType: 'updateInstanceData',
          code: 'INSTANCE_NOT_FOUND',
          message: 'Este gráfico não está mais no ar.',
        },
      });
    });

    // Assert: Camadas leaves that refusal to the panel that sent it.
    expect(
      screen.queryByRole('alert'),
      'only the refusal of the update this row sent may appear on it',
    ).toBeNull();
  });
});

describe('a preview behind its item', () => {
  it('gets the chip beside "em prévia" and "Atualizar prévia", but no "Disparar"', () => {
    // Arrange: the lower third in preview only, its item saved with a new name since.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('preview')],
    );

    // Act: "Atualizar prévia" on the lower third's row.
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Atualizar prévia' }));

    // Assert: the chip is there, no take is offered, and the preview is updated.
    expect(findLayerRow('Tarja').getByText('item mudou'), 'the preview is behind').toBeVisible();
    expect(
      findLayerRow('Tarja').queryByRole('button', { name: 'Disparar' }),
      'a take from a preview row would put on air what was not previewed',
    ).toBeNull();
    expect(fakeServer.listCommandsReceived(), 'the preview gets the changed fields').toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheLowerThirdInPreview,
        data: { nome: 'Ana Souza Lima', cargo: 'Piloto' },
        takeTimeFieldKeys: [],
      },
    ]);
  });
});
