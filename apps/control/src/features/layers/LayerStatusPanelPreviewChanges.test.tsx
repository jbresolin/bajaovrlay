/**
 * Camadas: "alterado no ar" on a layer's preview (apps/control)
 *
 * What this module is for:
 *   "Atualizar prévia" changes a preview in place, and the server lists the changed
 *   fields on it as on any instance of an item. "Tomar" carries that list to program,
 *   where "Salvar no item" is offered. Before the take, the operator must still see that
 *   what is previewed differs from the item, so the "em prévia" part of the row carries
 *   the chip too (gate 2 of PR #15). It only informs: there is no "Salvar no item" for a
 *   preview.
 *
 * What these tests prove:
 *   - A layer whose preview was changed shows "alterado no ar" beside "em prévia", with a
 *     tooltip naming the fields, and offers no "Salvar no item" while program is unchanged.
 *
 * What these tests deliberately do not cover:
 *   - The chip and "Salvar no item" on program: LayerStatusPanelOnAirChanges.test.tsx.
 *   - The list carried to program by "Tomar": apps/server's updatePreviewInstanceData.test.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildInstanceTakenFromItem,
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

/** The interview lower third in preview, its name retyped with "Atualizar prévia". */
function buildInterviewLowerThirdPreviewChanged(): Instance {
  const instance = buildInstanceTakenFromItem({
    id: '8f1d6a37-5c2e-4b90-a4d8-3e9b7c6f2a15',
    item: buildInterviewLowerThirdItem(),
    layerId: 'lower-third',
    target: 'preview',
    takenAt: '2026-10-10T13:00:00.000Z',
  });
  return {
    ...instance,
    status: 'loading',
    previewOrigin: 'manual',
    resolvedData: { ...instance.resolvedData, nome: 'Ana Souza Lima' },
    fieldsChangedOnAir: ['nome'],
  };
}

describe('"alterado no ar" on a preview', () => {
  it('shows beside "em prévia", names the fields, and offers no "Salvar no item"', async () => {
    // Arrange: Camadas with the changed preview of the lower third, nothing on program.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, {
      ...buildSlicesWithTheRaceClockAndTheLowerThird(),
      items: [buildInterviewLowerThirdItem()],
      instances: [buildInterviewLowerThirdPreviewChanged()],
    });
    const lowerThirdRow = within(screen.getByRole('listitem', { name: 'Tarja' }));

    // Act: reach the chip with the keyboard, which opens its tooltip.
    fireEvent.focus(lowerThirdRow.getByText('alterado no ar'));

    // Assert: the chip sits with the preview, names the field, and nothing saves from here.
    expect(
      lowerThirdRow.getByText('em prévia'),
      'the row must say it holds a preview',
    ).toBeVisible();
    await waitFor(() => {
      expect(
        screen.getByRole('tooltip').textContent,
        'the tooltip must name the field changed in the preview',
      ).toContain('Alterado na prévia: Nome');
    });
    expect(
      lowerThirdRow.queryByRole('button', { name: 'Salvar no item' }),
      'a preview is saved into its item only after "Tomar", from program',
    ).toBeNull();
  });
});
