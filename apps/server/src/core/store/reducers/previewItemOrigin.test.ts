/**
 * The previewItem reducer: who asked for the preview, and what an automatic one discards
 * (apps/server)
 *
 * What this module is for:
 *   A preview is asked for in two ways. By hand: a row's "Prévia" button or Shift+Space
 *   (origin `manual`). Or by "Prévia automática", which previews the item the rundown's
 *   cursor arrives on (origin `auto`). Items live on different layers, and a preview only
 *   replaces the preview of its own layer, so an operator arrowing down the rundown would
 *   leave a trail of previews behind. João's ruling (gate 2 of BAJAOVRLAY-15): an
 *   automatic preview first throws away every OTHER preview that was itself automatic;
 *   previews asked for by hand stay. It happens inside the one previewItem command, so no
 *   page ever sees the old and the new automatic preview together.
 *
 * What these tests prove:
 *   - Every preview instance previewItem makes says who asked for it (`previewOrigin`).
 *   - An automatic preview removes the automatic preview of another layer, leaves a manual
 *     preview of another layer, and replaces whatever is previewed on its own layer,
 *     manual included, as any preview does.
 *   - A manual preview removes nothing but the preview of its own layer.
 *   - The program output is never touched by any of this.
 *   - A refused automatic preview removes nothing.
 *
 * What these tests deliberately do not cover:
 *   - Everything else previewItem does (the data, the cursor, the stamps, each refusal);
 *     previewItem.test.ts covers it.
 *   - The mark the internal take step writes on every preview it makes (`manual`);
 *     putGraphicOnOutputPreview.test.ts.
 *   - WHEN a page sends origin `auto`; that is the control page's decision, proven in
 *     apps/control (RundownPanelPreview.test.tsx and RundownPanelPreviewAfterTake.test.tsx).
 */
import type { Instance, PreviewOrigin } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagClockOnProgram,
  buildPodiumItemOnPreviewByAutoPreview,
  buildTeam42LowerThirdOnPreview,
  buildYellowFlagItemOnPreview,
  readLayerOutputAndOriginOfEachInstance,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { ReducerContext } from './reducerTypes.js';
import {
  buildEnduroFinishItem,
  buildEnduroStartItem,
  buildPodiumTeamItem,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

// The preview under test gets an id of its own, so it can be told apart from the
// previews that were there before it.
const contextOfThePreviewUnderTest: ReducerContext = {
  ...contextOfTheRundownCommand,
  newInstanceId: 'd4b8a2f6-0c1e-4a3d-9f57-8e6c4b2a1d09',
};

/** Builds a lower third previewed before previews said who asked for them (no mark). */
function buildLowerThirdOnPreviewWithNoOriginMark(): Instance {
  const lowerThirdOnPreview = buildTeam42LowerThirdOnPreview();
  delete lowerThirdOnPreview.previewOrigin;
  return lowerThirdOnPreview;
}

/**
 * Builds a race day with the green clock on air, the three clock items of the main
 * session, the podium item (a lower third), and the previews of the scenario.
 */
function buildRaceDayWithPreviews(previewsBefore: Instance[]) {
  return buildRaceDaySlicesWithRundown({
    items: [
      buildEnduroStartItem(0),
      buildYellowFlagItem(1),
      buildEnduroFinishItem(2),
      buildPodiumTeamItem(0),
    ],
    instances: [buildGreenFlagClockOnProgram(), ...previewsBefore],
  });
}

describe('previewItem and the previews that were there before it', () => {
  const previewOriginScenarios: Array<{
    name: string;
    previewsBefore: Instance[];
    itemId: string;
    origin: PreviewOrigin;
    expectedInstancesAfter: string[];
  }> = [
    // The reason the rule exists: the cursor went from the podium item (lower third) to
    // the yellow flag (clock). Only the item at the cursor may stay in preview.
    {
      name: 'an automatic preview removes the automatic preview of another layer',
      previewsBefore: [buildPodiumItemOnPreviewByAutoPreview()],
      itemId: 'item-bandeira-amarela',
      origin: 'auto',
      expectedInstancesAfter: ['clock on program', 'clock on preview (auto)'],
    },
    // The operator asked to see that lower third; following the cursor must not take
    // away something they put there on purpose.
    {
      name: 'an automatic preview leaves a manual preview of another layer',
      previewsBefore: [buildTeam42LowerThirdOnPreview()],
      itemId: 'item-bandeira-amarela',
      origin: 'auto',
      expectedInstancesAfter: [
        'clock on program',
        'lower-third on preview (manual)',
        'clock on preview (auto)',
      ],
    },
    // One preview per layer is the older rule and it wins on the same layer: a manual
    // preview there gives way, as it would to any other preview.
    {
      name: 'an automatic preview replaces a manual preview on its own layer',
      previewsBefore: [buildYellowFlagItemOnPreview()],
      itemId: 'item-chegada-do-enduro',
      origin: 'auto',
      expectedInstancesAfter: ['clock on program', 'clock on preview (auto)'],
    },
    // The cursor came back to the same item, or two items in a row share a layer: still
    // one automatic preview, the new one.
    {
      name: 'an automatic preview replaces the automatic preview of its own layer',
      previewsBefore: [buildPodiumItemOnPreviewByAutoPreview()],
      itemId: 'item-podio-baja-ufpr',
      origin: 'auto',
      expectedInstancesAfter: ['clock on program', 'lower-third on preview (auto)'],
    },
    // A row's "Prévia" button while the cursor item is in preview: looking at another
    // row must not throw away what Space is about to send to air.
    {
      name: 'a manual preview leaves the automatic preview of another layer',
      previewsBefore: [buildPodiumItemOnPreviewByAutoPreview()],
      itemId: 'item-bandeira-amarela',
      origin: 'manual',
      expectedInstancesAfter: [
        'clock on program',
        'lower-third on preview (auto)',
        'clock on preview (manual)',
      ],
    },
    // A preview that does not say who asked is never taken for an automatic one: the
    // server only throws away what it knows nobody asked for by hand.
    {
      name: 'an automatic preview leaves a preview of another layer that carries no mark',
      previewsBefore: [buildLowerThirdOnPreviewWithNoOriginMark()],
      itemId: 'item-bandeira-amarela',
      origin: 'auto',
      expectedInstancesAfter: [
        'clock on program',
        'lower-third on preview',
        'clock on preview (auto)',
      ],
    },
  ];

  it.each(previewOriginScenarios)(
    '$name',
    ({ previewsBefore, itemId, origin, expectedInstancesAfter }) => {
      // Arrange: the green clock on air and the previews this row starts with.
      const slicesBefore = buildRaceDayWithPreviews(previewsBefore);

      // Act: preview the item of this row, asked for the way the row says.
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'previewItem', itemId, origin },
        contextOfThePreviewUnderTest,
      );

      // Assert: exactly the instances of the row are left, each preview saying who asked
      // for it; the clock on air is the very same; the new preview is of this row's item.
      const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
      const newPreview = instancesAfter?.find(
        (instance) => instance.id === contextOfThePreviewUnderTest.newInstanceId,
      );
      expect(
        readLayerOutputAndOriginOfEachInstance(instancesAfter),
        'only the previews this row names may be left, and program must stay',
      ).toEqual(expectedInstancesAfter);
      expect(instancesAfter?.[0], 'the clock on air must not be touched by a preview').toEqual(
        buildGreenFlagClockOnProgram(),
      );
      expect(newPreview?.itemId, 'the new preview must be of the item that was asked for').toBe(
        itemId,
      );
    },
  );
});

describe('an automatic previewItem that is refused', () => {
  const refusedAutoPreviewScenarios = [
    // Another operator deleted the row just as the cursor arrived on it.
    {
      name: 'removes nothing when the item does not exist',
      itemId: 'item-que-foi-excluido',
      expectedError: {
        code: 'ITEM_NOT_FOUND',
        message: 'O item "item-que-foi-excluido" não existe; ele pode ter sido excluído.',
      },
    },
    // Refused late, by the take itself (the item's layer is gone): the discard must not
    // have happened before the check either.
    {
      name: 'removes nothing when the take of the item is refused',
      itemId: 'item-de-camada-removida',
      expectedError: {
        code: 'LAYER_NOT_FOUND',
        message: 'A camada "patrocinadores-antigos" não existe.',
      },
    },
  ];

  it.each(refusedAutoPreviewScenarios)('$name', ({ itemId, expectedError }) => {
    // Arrange: the podium item in automatic preview, and an item whose layer no longer
    // exists beside the usual ones.
    const slicesWithPreviews = buildRaceDayWithPreviews([buildPodiumItemOnPreviewByAutoPreview()]);
    const itemOnALayerThatIsGone = {
      ...buildYellowFlagItem(3),
      id: 'item-de-camada-removida',
      layerId: 'patrocinadores-antigos',
    };
    const slicesBefore = {
      ...slicesWithPreviews,
      items: [...slicesWithPreviews.items, itemOnALayerThatIsGone],
    };

    // Act: "Prévia automática" asks for the item of this row.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewItem', itemId, origin: 'auto' },
      contextOfThePreviewUnderTest,
    );

    // Assert: refused with the reason of the row. A refusal carries no new slices, so the
    // store keeps the ones it had: the podium item is still in preview.
    expect(outcome, 'a refused automatic preview must change nothing at all').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
