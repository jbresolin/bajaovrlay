/**
 * Camadas: "Disparar" and "Atualizar no ar" beside "item mudou" (apps/control)
 *
 * What this module is for:
 *   A Camadas row behind its item offers two ways to catch up: "Disparar" takes the item
 *   again (the normal take), and "Atualizar no ar" sends only the fields behind to the
 *   instance on air (`updateInstanceData`), so the graphic changes in place. A preview row
 *   offers "Atualizar prévia" alone.
 *
 * What these tests prove:
 *   - "Atualizar no ar" sends only the fields behind, with the item's values, a field the
 *     item no longer stores as null, and never a clock (gate 2 of PR #49); it asks no
 *     question first. "Disparar" sends the take of the item.
 *   - The chip goes away once the air matches the item.
 *   - A refused "Atualizar no ar" says why on its own row; a refused update sent from
 *     elsewhere ("Edição rápida", the item editor) is not shown here; and a refusal never
 *     comes back by itself after the row caught up and fell behind again.
 *   - A preview behind its item gets "Atualizar prévia", and no "Disparar".
 *
 * What these tests deliberately do not cover:
 *   - The chip and its tooltip: LayerStatusPanelItemAheadOfTheAir.test.tsx.
 *   - Which fields count as behind, case by case: packages/shared itemAheadOfTheAir.test.ts.
 *   - The graphic changing on screen: apps/control's itemAheadOfTheAir.e2e.ts.
 */
import type { Item } from '@bajaovrlay/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEnduranceStartClockItem,
  buildInterviewLowerThirdItem,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';

import {
  buildEnduranceStartClockAsTaken,
  buildInterviewItemSavedAfterTheTake,
  buildInterviewLowerThirdAsTaken,
  findLayerRow,
  idOfTheClockOnAir,
  idOfTheLowerThirdInPreview,
  idOfTheLowerThirdOnAir,
  renderCamadasWith,
} from './itemAheadOfTheAirOnCamadas.testSupport';

/** The interview item after the take, saved without a role at all. */
function buildInterviewItemSavedWithoutARole(): Item {
  const item = buildInterviewLowerThirdItem();
  const fieldsWithoutTheRole = { ...item.fields };
  delete fieldsWithoutTheRole.cargo;
  return { ...item, fields: fieldsWithoutTheRole };
}

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

  it('"Atualizar no ar" sends a field the item no longer stores as empty', () => {
    // Arrange: the lower third on air with "Capitã", its item saved since with no role.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewItemSavedWithoutARole()],
      [buildInterviewLowerThirdAsTaken('program')],
    );

    // Act: "Atualizar no ar" on the lower third's row.
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Atualizar no ar' }));

    // Assert: the role is sent as null, which takes it off air.
    expect(fakeServer.listCommandsReceived(), 'the role must leave the air').toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheLowerThirdOnAir,
        data: { cargo: null },
        takeTimeFieldKeys: [],
      },
    ]);
  });

  it('"Atualizar no ar" sends the laps at once, and never the clock retimed beside them', () => {
    // Arrange: the clock on air; its item given seven laps AND a new time since.
    const item = buildEnduranceStartClockItem();
    const itemWithSevenLapsAndANewTime: Item = {
      ...item,
      fields: {
        ...item.fields,
        referenceTimeMs: { kind: 'literal', value: 10_800_000 },
        lapsCompletedByLeader: { kind: 'literal', value: 7 },
      },
    };
    const { fakeServer } = renderCamadasWith(
      [itemWithSevenLapsAndANewTime],
      [buildEnduranceStartClockAsTaken()],
    );

    // Act: "Atualizar no ar" on the clock's row.
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Atualizar no ar' }));

    // Assert: no question about the clock, and the laps alone sent.
    expect(screen.queryByRole('dialog'), 'nothing about the clock is asked').toBeNull();
    expect(fakeServer.listCommandsReceived(), 'the laps go on air, the clock stays').toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheClockOnAir,
        data: { lapsCompletedByLeader: 7 },
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

    // Assert: the take of the item, as the rundown sends it, saying the page showed the
    // lower third on air there (BAJAOVRLAY-69).
    expect(fakeServer.listCommandsReceived(), 'the item must be taken again').toEqual([
      {
        type: 'takeItem',
        itemId: buildInterviewLowerThirdItem().id,
        instanceIdSeenOnAir: idOfTheLowerThirdOnAir,
      },
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

  it('does not come back by itself once the row caught up and fell behind again', async () => {
    // Arrange: the lower third behind its item, its update refused and the refusal shown.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('program')],
    );
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Atualizar no ar' }));
    fakeServer.refuseLastCommand({
      code: 'INSTANCE_NOT_FOUND',
      message: 'Este gráfico não está mais no ar.',
    });
    await waitFor(() => {
      expect(findLayerRow('Tarja').getByRole('alert'), 'the refusal is shown').toBeVisible();
    });

    // Act: the air catches up another way ("Edição rápida"), then the item is saved again.
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
    const itemSavedAgain = buildInterviewItemSavedAfterTheTake();
    fakeServer.sendMessage({
      type: 'slice',
      name: 'items',
      slice: [
        {
          ...itemSavedAgain,
          fields: {
            ...itemSavedAgain.fields,
            cargo: { kind: 'literal', value: 'Chefe de equipe' },
          },
        },
      ],
    });

    // Assert: the chip is back for the new save, without the old refusal.
    expect(findLayerRow('Tarja').getByText('item mudou'), 'the row is behind again').toBeVisible();
    expect(
      findLayerRow('Tarja').queryByRole('alert'),
      'a refusal of an earlier update must not come back by itself',
    ).toBeNull();
  });
});

describe('a preview behind its item', () => {
  it('gets "Atualizar prévia", but no "Disparar"', () => {
    // Arrange: the lower third in preview only, its item saved with a new name since.
    const { fakeServer } = renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('preview')],
    );

    // Act: "Atualizar prévia" on the lower third's row.
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Atualizar prévia' }));

    // Assert: no take is offered, and the preview is updated.
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
