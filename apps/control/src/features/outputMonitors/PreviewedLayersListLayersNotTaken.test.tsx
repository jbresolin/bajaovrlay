/**
 * "Tomar tudo" that left layers another console had just changed (apps/control)
 *
 * What this module is for:
 *   "Tomar tudo" checks each layer on its own (BAJAOVRLAY-69): a layer another console
 *   changed less than 2 s before, unseen by this page, is left as it is and the others are
 *   taken. The server accepts the command and lists the layers left in its answer; the page
 *   shows them where it shows "Tomar tudo"'s refusals, under the lines of the Prévia monitor.
 *
 * What these tests prove:
 *   - Under the lines, the page says "Tomar tudo" was done but for these layers, and lists
 *     each layer left with the server's sentence.
 *
 * What these tests deliberately do not cover:
 *   - Which layers the server leaves, and its sentence: apps/server's
 *     reducers/takeAllPreviewsAnotherConsole.test.ts.
 *   - "Tomar tudo" refused whole, or sent: PreviewedLayersListTakeAll.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildLowerThirdPreviewWhoseItemIsGone,
  buildRaceClockPreviewOfItem,
} from '@/state/previewLikeTheServerSends.testSupport';
import {
  buildSlicesWithTheEnduranceRundown,
  enduranceStartItemId,
} from '@/state/rundownLikeTheServerSends.testSupport';
import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import { PreviewedLayersList } from './PreviewedLayersList';

// Saturday of the endurance race: the start and the interview band previewed at 9:58.
const momentOfThePreviews = '2026-10-10T12:58:00.000Z';

/** What the server's sentence says of "Tarja", which another console's Produtor had just taken. */
const sentenceOfTheLowerThirdLeft =
  'Outra mesa (Produtor) tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; ' +
  'sua tomada de "Tarja – Ana Souza" não foi feita.';

describe('"Tomar tudo" that left a layer for another console', () => {
  it('lists, under the lines, each layer it left, with the server sentence', async () => {
    // Arrange: the start and the band previewed, and "Tomar tudo" pressed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<PreviewedLayersList />, {
      ...buildSlicesWithTheEnduranceRundown(enduranceStartItemId),
      graphics: [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()],
      instances: [
        buildRaceClockPreviewOfItem(enduranceStartItemId, momentOfThePreviews),
        buildLowerThirdPreviewWhoseItemIsGone(momentOfThePreviews),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tomar tudo' }));

    // Act: the server took the clock and left "Tarja", and says so in its ok answer.
    fakeServer.sendMessage({
      type: 'commandResult',
      requestId: 'pedido-1',
      ok: true,
      layersNotTaken: [
        {
          layerId: 'lower-third',
          error: { code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE', message: sentenceOfTheLowerThirdLeft },
        },
      ],
    });

    // Assert: "done but for these layers", then "Tarja" with what the other console did.
    const refusal = await screen.findByRole('alert');
    expect(refusal, '"Tomar tudo" must say which layers it left').toHaveTextContent(
      'Tomar tudo foi feito, menos nestas camadas:',
    );
    expect(
      within(refusal)
        .getAllByRole('listitem')
        .map((line) => line.textContent),
      'each layer left must be listed with the server sentence',
    ).toEqual([sentenceOfTheLowerThirdLeft]);
  });
});
