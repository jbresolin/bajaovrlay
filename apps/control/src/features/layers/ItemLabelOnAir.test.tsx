/**
 * Layer status panel: naming the item that is on air (apps/control)
 *
 * What this module is for:
 *   When a graphic went on air from the rundown, the operator knows it by the label of
 *   the item ("Largada do enduro"), not only by the graphic's name ("Relógio de prova",
 *   which is the same for every clock item). The server stamps such an instance with the
 *   item's id, and the layer panel shows that item's label on the layer's row.
 *
 * What these tests prove:
 *   - A layer whose instance came from an item shows the item's label, next to the
 *     graphic's name.
 *   - A layer whose instance was taken by hand (no item id) shows only the graphic's name.
 *   - If the item was deleted after it went on air, the row keeps the graphic's name and
 *     shows no label, instead of an id nobody can read.
 *   - The label follows the server: when the item is renamed, the row shows the new name.
 *
 * What these tests deliberately do not cover:
 *   - Everything else on the row (time, status, "Limpar"); LayerStatusPanel.test.tsx does.
 *   - Taking an item; the rundown's tests and e2e/rundownTakeWithSpace.e2e.ts do.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithTheEnduranceRundown,
  buildSlicesWithTheEnduranceStartOnAir,
} from '@/state/rundownLikeTheServerSends.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

const momentTheClockWentOnAir = '2026-10-10T13:00:00.000Z';

describe('the item label on the layer panel', () => {
  it('shows the label of the item that put the graphic on air', () => {
    // Arrange: the operator fired "Largada do enduro", so the clock on air carries its id.
    const slices = buildSlicesWithTheEnduranceStartOnAir(momentTheClockWentOnAir);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the clock row names the item and still names the graphic.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('Largada do enduro'),
      'the row must show the label of the item that is on air on its layer',
    ).toBeInTheDocument();
    expect(
      clockRow.getByText('Relógio de prova'),
      'the row must keep showing the name of the graphic',
    ).toBeInTheDocument();
  });

  it('shows no item label for a graphic that was taken by hand', () => {
    // Arrange: the rundown has its three items, but the clock on air was taken from the
    // take panel, so its instance has no item id.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    slices.instances = [buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir)];

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the clock row shows the graphic and none of the rundown's labels.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('Relógio de prova'),
      'a graphic taken by hand must still be listed by its name',
    ).toBeInTheDocument();
    expect(
      clockRow.queryByText('Largada do enduro'),
      'a graphic taken by hand must not borrow the label of an item',
    ).toBeNull();
  });

  it('shows only the graphic name when the item was deleted after it went on air', () => {
    // Arrange: "Largada do enduro" is on air, and then someone deleted it from the rundown.
    const slices = buildSlicesWithTheEnduranceStartOnAir(momentTheClockWentOnAir);
    slices.items = slices.items.filter((item) => item.id !== 'item-largada-do-enduro');

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the graphic is still listed; there is no label and no raw id on the row.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('Relógio de prova'),
      'what is on air must stay listed even though its item is gone',
    ).toBeInTheDocument();
    expect(
      clockRow.queryByText('item-largada-do-enduro'),
      'the row must not show an item id in place of a label',
    ).toBeNull();
  });

  it('shows the new label when the item on air is renamed', () => {
    // Arrange: the panel with "Largada do enduro" on air.
    const slices = buildSlicesWithTheEnduranceStartOnAir(momentTheClockWentOnAir);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Act: the server sends the items with that one renamed in the item editor.
    const itemsWithTheStartRenamed = slices.items.map((item) =>
      item.id === 'item-largada-do-enduro' ? { ...item, label: 'Largada — Bateria 2' } : item,
    );
    fakeServer.sendMessage({ type: 'slice', name: 'items', slice: itemsWithTheStartRenamed });

    // Assert: the row shows the new label.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('Largada — Bateria 2'),
      'the label on the layer row must follow the item as the server has it now',
    ).toBeInTheDocument();
  });
});
