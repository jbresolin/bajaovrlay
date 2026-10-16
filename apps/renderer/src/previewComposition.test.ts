/**
 * What the preview page draws: the screen as it will look after the take (apps/renderer)
 *
 * What this module is for:
 *   João's rule for "Prévia": it shows exactly what the screen will look like when the
 *   operator takes. So the preview page does not draw the preview instances alone: on a
 *   layer with nothing previewed it draws what is on air there, because a take leaves that
 *   layer as it is. selectInstancesForPreviewComposition answers, from the server's
 *   `instances` slice and its `previewClearedLayerIds` slice (the layers marked "will be
 *   cleared"), which instances the preview page draws, layer by layer:
 *     1. the preview instance on that layer, if there is one; otherwise
 *     2. nothing, if the layer is marked "will be cleared"; otherwise
 *     3. the program instance on that layer.
 *
 * What these tests prove:
 *   - A layer with only a program instance shows it; a previewed layer shows the preview
 *     and never its program instance; a marked layer shows nothing; layers do not affect
 *     each other.
 *   - A preview and a marker on the same layer (the server never lists both) shows the
 *     preview, the first rule of the three.
 *   - Two instances of one output on one layer (the server never lists two) show the later
 *     one in the list, as the reconciler has always read such a slice.
 *   - An instance on a layer the layers slice does not list is kept like any other; the
 *     player then logs it and leaves it undrawn, as it did before this composition.
 *   - The answer keeps the order of the slice.
 *
 * What these tests deliberately do not cover:
 *   - What the page then does when the composition changes (load, update, replace as a cut,
 *     stop); instanceReconciler.preview.test.ts.
 *   - The page OBS loads, which draws program instances only and never reads the markers;
 *     instanceReconciler.test.ts.
 *   - The real page in Chromium; e2e/previewPage.e2e.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  createEnduroClockInstance,
  createFinalClockInstance,
  createTeamLowerThirdInstance,
  feiLowerThirdInstanceId,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';
import { selectInstancesForPreviewComposition } from './previewComposition.js';

/** Builds the same instance as a rehearsal: on the preview output instead of on air. */
function createRehearsalOf(instance: Instance): Instance {
  return { ...instance, target: 'preview' };
}

const enduroClockOnAir = createEnduroClockInstance();
const finalClockOnAir = createFinalClockInstance();
const rehearsedFinalClock = createRehearsalOf(createFinalClockInstance());
const ufprLowerThirdOnAir = createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR');
const rehearsedFeiLowerThird = createRehearsalOf(
  createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja'),
);
const tickerOnAir: Instance = {
  ...createTeamLowerThirdInstance('5f2b8d61-93a4-4c07-b1e8-7d4a0c6e2f39', 13, 'Baja Mackenzie'),
  layerId: 'ticker',
};

const previewCompositionScenarios = [
  // Nothing on air and nothing previewed: the preview page is empty, like the screen.
  {
    name: 'draws nothing when nothing is on air or previewed',
    instances: [],
    previewClearedLayerIds: [],
    expectedInstances: [],
  },
  // The clock is on air and the operator previews nothing: a take would leave it there.
  {
    name: 'draws the program instance of a layer with nothing previewed',
    instances: [enduroClockOnAir],
    previewClearedLayerIds: [],
    expectedInstances: [enduroClockOnAir],
  },
  // The final clock is previewed over the enduro clock: after the take only it is there.
  {
    name: 'draws only the preview instance of a layer that also has a program instance',
    instances: [enduroClockOnAir, rehearsedFinalClock],
    previewClearedLayerIds: [],
    expectedInstances: [rehearsedFinalClock],
  },
  // The order in the slice must not decide it: a preview listed first still wins.
  {
    name: 'draws only the preview instance even when it is listed before the program one',
    instances: [rehearsedFinalClock, enduroClockOnAir],
    previewClearedLayerIds: [],
    expectedInstances: [rehearsedFinalClock],
  },
  // "Prévia: limpar" on the clock layer: after the take the clock is gone.
  {
    name: 'draws nothing on a layer marked "will be cleared" that has a program instance',
    instances: [enduroClockOnAir],
    previewClearedLayerIds: ['clock'],
    expectedInstances: [],
  },
  // The everyday case of the walk: the clock stays on air, a lower third is previewed.
  {
    name: 'draws the program instance of one layer and the preview instance of another',
    instances: [enduroClockOnAir, rehearsedFeiLowerThird],
    previewClearedLayerIds: [],
    expectedInstances: [enduroClockOnAir, rehearsedFeiLowerThird],
  },
  // A marker empties its own layer only; the lower third on air stays in the picture.
  {
    name: 'empties only the marked layer and keeps the program instance of the others',
    instances: [enduroClockOnAir, ufprLowerThirdOnAir],
    previewClearedLayerIds: ['clock'],
    expectedInstances: [ufprLowerThirdOnAir],
  },
  // A marker left on a layer whose instance has already left the air changes nothing.
  {
    name: 'draws nothing on a marked layer that has nothing on air',
    instances: [],
    previewClearedLayerIds: ['clock'],
    expectedInstances: [],
  },
  // The server never lists both (previewing a layer removes its marker), but if it ever
  // did, the first of the three rules wins: the preview instance is what the take puts on.
  {
    name: 'draws the preview instance of a layer that is also marked "will be cleared"',
    instances: [enduroClockOnAir, rehearsedFinalClock],
    previewClearedLayerIds: ['clock'],
    expectedInstances: [rehearsedFinalClock],
  },
  // The server keeps one program instance per layer; if a slice ever listed two, the later
  // one is drawn, the rule the reconciler has always used for such a slice.
  {
    name: 'draws the later of two program instances listed on the same layer',
    instances: [enduroClockOnAir, finalClockOnAir],
    previewClearedLayerIds: [],
    expectedInstances: [finalClockOnAir],
  },
  // The ticker layer is not in the layers slice. The composition does not judge that; the
  // player logs the instance and leaves it undrawn, exactly as before this composition.
  {
    name: 'keeps a program instance on a layer the layers slice does not list',
    instances: [tickerOnAir],
    previewClearedLayerIds: [],
    expectedInstances: [tickerOnAir],
  },
];

describe('selectInstancesForPreviewComposition', () => {
  it.each(previewCompositionScenarios)('$name', (scenario) => {
    // Arrange: what the server lists as instances and as layers marked "will be cleared".
    const { instances, previewClearedLayerIds, expectedInstances } = scenario;

    // Act: ask which instances the preview page draws.
    const composedInstances = selectInstancesForPreviewComposition({
      instances,
      previewClearedLayerIds,
    });

    // Assert: exactly the instances of the screen after the take, in the slice's order.
    expect(
      composedInstances,
      'per layer the preview page must draw the preview instance, else nothing on a marked layer, else the program instance',
    ).toStrictEqual(expectedInstances);
  });
});
