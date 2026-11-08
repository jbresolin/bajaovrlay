/**
 * Camadas: the chip "item mudou" (apps/control)
 *
 * What this module is for:
 *   An item saved after its graphic was taken leaves the air behind it: the lower third on
 *   air still says "Ana Souza" while the item now says "Ana Souza Lima". The Camadas row
 *   then carries the chip "item mudou", whose tooltip names the fields behind by their
 *   titles. It is the reverse of "alterado no ar".
 *
 * What these tests prove:
 *   - The chip and its tooltip, and its absence when the air matches the item or the item
 *     was deleted.
 *   - It leaves the fields changed on air to "alterado no ar".
 *   - A clock is never behind (gate 2 of PR #49): a clock retimed in the item gets no chip.
 *   - A layer's preview behind its item gets the chip beside "em prévia".
 *
 * What these tests deliberately do not cover:
 *   - The buttons and what they send: LayerStatusPanelItemAheadOfTheAirButtons.test.tsx.
 *   - Which fields count as behind, case by case: packages/shared itemAheadOfTheAir.test.ts.
 *   - That a source poll redraws nothing: LayerStatusPanelItemAheadOfTheAirRedraws.test.tsx.
 *   - The graphic changing on screen: apps/control's itemAheadOfTheAir.e2e.ts.
 */
import type { Instance, Item } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  renderCamadasWith,
} from './itemAheadOfTheAirOnCamadas.testSupport';

/** The endurance start item after the take, restarting from 180:00 and counting up. */
function buildEnduranceStartItemRetimedAfterTheTake(): Item {
  const item = buildEnduranceStartClockItem();
  return {
    ...item,
    fields: {
      ...item.fields,
      referenceTimeMs: { kind: 'literal', value: 10_800_000 },
      clockMode: { kind: 'literal', value: 'elapsed' },
    },
  };
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

  it('is not shown for a clock retimed in the item, which reaches air with the next take', () => {
    // Arrange and act: the start clock on air from 240:00, its item now from 180:00 counting up.
    renderCamadasWith(
      [buildEnduranceStartItemRetimedAfterTheTake()],
      [buildEnduranceStartClockAsTaken()],
    );

    // Assert: no chip and nothing to press on the clock's row.
    expect(
      findLayerRow('Relógio').queryByText('item mudou'),
      'a clock is never reported behind its item',
    ).toBeNull();
    expect(
      findLayerRow('Relógio').queryByRole('button', { name: 'Atualizar no ar' }),
      'a clock is not updated from this mark',
    ).toBeNull();
  });

  it('is shown beside "em prévia" for a preview behind its item', () => {
    // Arrange and act: the lower third in preview only, its item saved with a new name since.
    renderCamadasWith(
      [buildInterviewItemSavedAfterTheTake()],
      [buildInterviewLowerThirdAsTaken('preview')],
    );

    // Assert: the preview is marked too.
    expect(findLayerRow('Tarja').getByText('em prévia'), 'the preview is held').toBeVisible();
    expect(findLayerRow('Tarja').getByText('item mudou'), 'the preview is behind').toBeVisible();
  });
});
