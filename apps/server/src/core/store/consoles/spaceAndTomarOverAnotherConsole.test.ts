/**
 * Space and "Tomar" on a layer another console just changed (apps/server)
 *
 * What this module is for:
 *   A console's take is refused when another console changed its layer less than 2 s ago and
 *   the page had not shown it yet (BAJAOVRLAY-69). Besides takeItem (a row's "Disparar", a
 *   quick-fire button or key), two more take commands carry what the page saw: Space
 *   (takeNext, the cursor's item) and "Tomar" under the Prévia monitor (takePreview, of a
 *   preview or of a "vai limpar" mark). They must be refused the same way.
 *
 * What these tests prove:
 *   - Space on the cursor's item is refused with the same sentence as a take of that item.
 *   - "Tomar" of a preview is refused, naming the previewed item.
 *   - "Tomar" of a "vai limpar" mark is refused, saying the clear was not done.
 *
 * What these tests deliberately do not cover:
 *   - The rule case by case (same console, after 2 s, seen, a macro...):
 *     unseenChangeByAnotherConsole.test.ts, through takeItem, the path every take shares.
 *   - "Tomar tudo": takeAllPreviewsAnotherConsole.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { reduceCommand } from '../reducers/reduceCommand.js';
import { mainSessionRundownId } from '../reducers/rundownSlices.testSupport.js';
import {
  buildCaptainOnProgram,
  buildChiefOnPreview,
  buildContextOfMesa2,
  buildMesa1TookTheCaptain,
  buildRaceDayWithBothLowerThirds,
  refusalOfTheChiefOverTheCaptain,
} from './twoConsolesOnOneLayerFixtures.testSupport.js';

describe('Space and "Tomar" over another console unseen take', () => {
  it('refuses Space (takeNext) on the cursor item the same way', () => {
    // Arrange: the main session's cursor on the chief; Mesa 1 took the captain 0,8 s ago.
    const slicesBefore = buildRaceDayWithBothLowerThirds({
      instances: [buildCaptainOnProgram()],
      cursorItemId: 'item-tarja-chefe-ufsc',
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses Space.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeNext', rundownId: mainSessionRundownId, instanceIdSeenOnAir: null },
      context,
    );

    // Assert: the same refusal as a take of the chief.
    expect(
      outcome.status === 'refused' ? outcome.error.message : 'applied',
      'Space must be refused as a take of the cursor item is',
    ).toBe(refusalOfTheChiefOverTheCaptain);
  });

  it('refuses "Tomar" (takePreview), naming the previewed item', () => {
    // Arrange: the chief in Prévia on "Tarja"; Mesa 1 took the captain 0,8 s ago.
    const slicesBefore = buildRaceDayWithBothLowerThirds({
      instances: [buildCaptainOnProgram(), buildChiefOnPreview()],
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses "Tomar" on "Tarja".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'lower-third', instanceIdSeenOnAir: null },
      context,
    );

    // Assert: refused, naming the previewed item (a refusal changes no slice: the preview stays).
    expect(
      outcome.status === 'refused' ? outcome.error.message : 'applied',
      '"Tomar" must be refused, naming the item in Prévia',
    ).toBe(refusalOfTheChiefOverTheCaptain);
  });

  it('refuses "Tomar" of a "vai limpar" mark, saying the clear was not done', () => {
    // Arrange: "Tarja" marked "vai limpar"; Mesa 1 took the captain 0,8 s ago.
    const slicesBefore = buildRaceDayWithBothLowerThirds({
      instances: [buildCaptainOnProgram()],
      previewClearedLayerIds: ['lower-third'],
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses "Tomar" on "Tarja", having seen it empty.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'lower-third', instanceIdSeenOnAir: null },
      context,
    );

    // Assert: refused; the clear of the captain, whom Mesa 2 never saw, is not done.
    expect(
      outcome.status === 'refused' ? outcome.error.message : 'applied',
      'the clear must be refused, saying so',
    ).toBe(
      'Outra mesa (Produtor) tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; ' +
        'sua limpeza desta camada não foi feita.',
    );
  });
});
