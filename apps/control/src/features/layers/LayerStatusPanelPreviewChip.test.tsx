/**
 * Layer status panel: the "em prévia" chip (apps/control)
 *
 * What this module is for:
 *   The layer panel lists what is ON AIR on each layer. A layer can also hold something
 *   on the preview output, which the viewers do not see. So that the operator is never
 *   surprised by it, a layer that holds a preview carries a small chip, "em prévia",
 *   next to its name. Everything else on the row keeps describing the program output.
 *
 * What these tests prove:
 *   - A layer with a preview and nothing on air shows the chip and still says "vazia".
 *   - A layer with one graphic on air and another previewed shows the chip, and the row
 *     keeps naming the graphic on air with ITS status; the preview adds no status badge
 *     and its graphic is not named.
 *   - A layer with a graphic on air and no preview shows no chip, and no other layer
 *     gets one.
 *   - The chip goes when the server says the preview is gone.
 *
 * What these tests deliberately do not cover:
 *   - Everything else about the row (names, times, status, "Limpar"): LayerStatusPanel.test.tsx.
 *   - What is previewed and the buttons that take or discard it; those are under the
 *     "Prévia" monitor (features/outputMonitors/PreviewedLayersList.test.tsx).
 *   - That "Limpar" on a row also removes the layer's preview; that is the server's
 *     clearLayer (docs/decisions.md, PR #3), proven by apps/server's tests.
 */
import type { Instance, Slices } from '@bajaovrlay/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildLowerThirdPreviewMadeByHand,
  buildRaceClockPreviewOfItem,
} from '@/state/previewLikeTheServerSends.testSupport';
import {
  buildSlicesWithTheEnduranceRundown,
  enduranceStartItemId,
  yellowFlagItemId,
} from '@/state/rundownLikeTheServerSends.testSupport';
import {
  buildRaceClockGraphic,
  buildRaceClockInstanceOnTheClockLayer,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

// Saturday of the endurance race: the start went on air at 10:00 and the yellow flag is
// previewed five minutes later.
const momentTheStartWentOnAir = '2026-10-10T13:00:00.000Z';
const momentTheYellowFlagWasPreviewed = '2026-10-10T13:05:00.000Z';

/** The endurance rundown, the race clock and the lower third, and these instances. */
function buildSlicesWithTheseInstances(instances: Instance[]): Slices {
  return {
    ...buildSlicesWithTheEnduranceRundown(yellowFlagItemId),
    graphics: [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()],
    instances,
  };
}

/** The start of the endurance race on the program output, already reported "No ar". */
function buildStartItemOnAir(): Instance {
  return {
    ...buildRaceClockInstanceOnTheClockLayer(momentTheStartWentOnAir),
    itemId: enduranceStartItemId,
    status: 'on-air',
  };
}

describe('the "em prévia" chip of the layer status panel', () => {
  it('marks a layer that holds a preview and nothing on air, which still says "vazia"', () => {
    // Arrange: an interview band is previewed on the "Tarja" layer; nothing is on air.
    const slices = buildSlicesWithTheseInstances([
      buildLowerThirdPreviewMadeByHand(momentTheYellowFlagWasPreviewed),
    ]);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the row has the chip, and still tells the truth about the air: empty.
    const lowerThirdRow = within(screen.getByRole('listitem', { name: 'Tarja' }));
    expect(
      lowerThirdRow.getByText('em prévia'),
      'a layer that holds a preview must carry the "em prévia" chip',
    ).toBeInTheDocument();
    expect(
      lowerThirdRow.getByText('vazia'),
      'a preview is not on air: the layer must still say "vazia"',
    ).toBeInTheDocument();
    expect(
      lowerThirdRow.queryByText('Tarja de entrevista'),
      'the row describes the program output and must not name the previewed graphic',
    ).toBeNull();
    expect(
      lowerThirdRow.queryByText('Carregando'),
      'a preview must add no status badge: its status never changes and means nothing',
    ).toBeNull();
  });

  it('marks a layer that has one thing on air and another in preview, and keeps describing the air', () => {
    // Arrange: the start is on air on the clock layer ("No ar") and the yellow flag is
    // previewed on that same layer.
    const slices = buildSlicesWithTheseInstances([
      buildStartItemOnAir(),
      buildRaceClockPreviewOfItem(yellowFlagItemId, momentTheYellowFlagWasPreviewed),
    ]);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the chip is there, and the rest of the row is about what is on air.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('em prévia'),
      'the clock layer holds a preview and must carry the chip',
    ).toBeInTheDocument();
    expect(
      clockRow.getByText('Largada do enduro'),
      'the row must keep naming the item that is on air, not the previewed one',
    ).toBeInTheDocument();
    expect(
      clockRow.queryByText('Bandeira amarela'),
      'the previewed item must not be named on the row',
    ).toBeNull();
    expect(
      clockRow.getByText('No ar'),
      'the status badge must be the one of the instance on air',
    ).toBeInTheDocument();
    expect(
      clockRow.queryByText('Carregando'),
      'the preview (status "loading" for good) must add no badge of its own',
    ).toBeNull();
  });

  it('shows no chip on any layer when nothing is previewed', () => {
    // Arrange: the start is on air and nothing is previewed.
    const slices = buildSlicesWithTheseInstances([buildStartItemOnAir()]);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: no chip anywhere.
    expect(
      screen.queryByText('em prévia'),
      'a graphic on the program output is not a preview: no layer may carry the chip',
    ).toBeNull();
  });

  it('puts the chip only on the layer that holds the preview', () => {
    // Arrange: one preview, on the "Tarja" layer.
    const slices = buildSlicesWithTheseInstances([
      buildLowerThirdPreviewMadeByHand(momentTheYellowFlagWasPreviewed),
    ]);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: exactly one chip on the whole panel.
    expect(
      screen.getAllByText('em prévia'),
      'only the one layer that holds a preview may carry the chip',
    ).toHaveLength(1);
  });

  it('takes the chip off when the server says the preview is gone', () => {
    // Arrange: the panel with a band previewed on the "Tarja" layer.
    const slices = buildSlicesWithTheseInstances([
      buildLowerThirdPreviewMadeByHand(momentTheYellowFlagWasPreviewed),
    ]);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Act: the server sends its instances without the preview, as after "Descartar".
    fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });

    // Assert: the chip is gone.
    expect(
      screen.queryByText('em prévia'),
      'the chip must follow the server and go when the preview does',
    ).toBeNull();
  });
});
