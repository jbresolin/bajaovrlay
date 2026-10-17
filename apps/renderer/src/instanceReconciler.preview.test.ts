/**
 * Deciding what to do on a page that draws the preview output (apps/renderer)
 *
 * What this module is for:
 *   The control page frames the renderer page at `/render/?target=preview&monitor=1` as
 *   "Prévia", and João's rule is that it shows exactly what the screen will look like after
 *   the take. That page runs the same instanceReconciler as the page OBS loads, told to draw
 *   `preview`. Two things differ. What it compares is the preview composition
 *   (previewComposition.ts): per layer the preview instance, else nothing on a layer
 *   marked "will be cleared", else the program instance. And when one instance replaces
 *   another on a layer, the swap is always the instant one (the `cut` way: no
 *   out-animation, no in-animation), whatever the layer's own replace policy says.
 *   Everything else (load, update, stop, rebuild) is the program page's rules.
 *
 * What these tests prove, for a reconciler told to draw the preview output:
 *   - A preview instance on an empty layer is loaded and played with its in-animation, as
 *     a take is on air.
 *   - A second preview on an occupied layer is a replace carried out as `cut`, on a layer
 *     whose policy is `out-then-in`, on one whose policy is already `cut`, and on a layer
 *     the slice does not list.
 *   - Changed data on the same preview is an update; a preview discarded over an empty
 *     layer is stopped and disposed with its out-animation, as on the program page.
 *   - A rebuild after a hello disposes what was drawn and loads the composition, leaving a
 *     marked layer empty.
 *
 * What these tests deliberately do not cover:
 *   - A program instance the preview page shows, and the markers, through take, update,
 *     preview, discard and "Prévia: limpar"; instanceReconciler.previewComposition.test.ts.
 *   - The composition rule row by row; previewComposition.test.ts.
 *   - The same decisions for the program output, which never reads the markers;
 *     instanceReconciler.test.ts and instanceReconciler.rebuild.test.ts.
 *   - What the player then calls on the graphics; instancePlayer.preview.test.ts.
 *   - That the preview page tells the server nothing; e2e/previewPage.e2e.ts listens on
 *     the page's WebSocket.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { decideLayerOperations, decideRebuildOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createFinalClockInstance,
  createTeamLowerThirdInstance,
  enduroClockInstanceId,
  feiLowerThirdInstanceId,
  layersOfTheStream,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';

/** Builds the same instance as a rehearsal: on the preview output instead of on air. */
function createRehearsalOf(instance: Instance): Instance {
  return { ...instance, target: 'preview' };
}

const finalClockOnAir = createFinalClockInstance();
const rehearsedEnduroClock = createRehearsalOf(createEnduroClockInstance());
const rehearsedFinalClock = createRehearsalOf(createFinalClockInstance());
const rehearsedUfprLowerThird = createRehearsalOf(
  createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
);
const rehearsedFeiLowerThird = createRehearsalOf(
  createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja'),
);

const previewSliceChangeScenarios = [
  // The everyday rehearsal: the operator previews the clock and nothing is on air.
  {
    name: 'loads and plays a preview instance on an empty layer, with its in-animation',
    previousInstances: [],
    previousPreviewClearedLayerIds: [],
    nextInstances: [rehearsedEnduroClock],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'loadAndPlay', instance: rehearsedEnduroClock, skipAnimation: false }],
      },
    ],
  },
  // "Descartar" with nothing on air: the rehearsal is gone and nothing replaces it.
  {
    name: 'stops and disposes a discarded preview instance on a layer with nothing on air',
    previousInstances: [rehearsedEnduroClock],
    previousPreviewClearedLayerIds: [],
    nextInstances: [],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'stopAndDispose', instanceId: enduroClockInstanceId }],
      },
    ],
  },
  // The cursor moved to the next item on the clock layer, whose own policy is
  // out-then-in. On the preview page the swap is instant all the same.
  {
    name: 'replaces as a cut on a layer whose own policy is out-then-in',
    previousInstances: [rehearsedEnduroClock],
    previousPreviewClearedLayerIds: [],
    nextInstances: [rehearsedFinalClock],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: enduroClockInstanceId,
            incomingInstance: rehearsedFinalClock,
            replacePolicy: 'cut',
          },
        ],
      },
    ],
  },
  // The lower-third layer cuts anyway: the preview page must not change that.
  {
    name: 'replaces as a cut on a layer whose own policy is already cut',
    previousInstances: [rehearsedUfprLowerThird],
    previousPreviewClearedLayerIds: [],
    nextInstances: [rehearsedFeiLowerThird],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'lower-third',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: ufprLowerThirdInstanceId,
            incomingInstance: rehearsedFeiLowerThird,
            replacePolicy: 'cut',
          },
        ],
      },
    ],
  },
  // The operator corrected the flag of the rehearsed clock in "Edição rápida": the same
  // rehearsal with new data gets only the changed field, as on the program page.
  {
    name: 'updates the same preview instance with only the fields that changed',
    previousInstances: [rehearsedEnduroClock],
    previousPreviewClearedLayerIds: [],
    nextInstances: [
      {
        ...rehearsedEnduroClock,
        resolvedData: { sessionName: 'Enduro de Resistência', state: 'yellow', running: true },
      },
    ],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'updateData',
            instanceId: enduroClockInstanceId,
            changedData: { state: 'yellow' },
          },
        ],
      },
    ],
  },
];

describe('decideLayerOperations for a page that draws the preview output', () => {
  it.each(previewSliceChangeScenarios)('$name', (scenario) => {
    // Arrange: the instances and markers the server listed last and the ones just arrived.
    const {
      previousInstances,
      previousPreviewClearedLayerIds,
      nextInstances,
      nextPreviewClearedLayerIds,
      expectedLayerOperations,
    } = scenario;

    // Act: ask what a page that draws the preview output must do on each layer.
    const layerOperations = decideLayerOperations({
      previousInstances,
      previousPreviewClearedLayerIds,
      nextInstances,
      nextPreviewClearedLayerIds,
      layers: layersOfTheStream,
      drawnOutput: 'preview',
    });

    // Assert: exactly the expected operations, layer by layer.
    expect(
      layerOperations,
      'a preview page must act on the screen after the take, and replace as a cut',
    ).toStrictEqual(expectedLayerOperations);
  });

  it('replaces as a cut when the layer is not in the layers slice', () => {
    // Arrange: a second rehearsal on the clock layer, but a layers slice without it.
    const layersWithoutTheClock = layersOfTheStream.filter((layer) => layer.id !== 'clock');

    // Act: ask what a page that draws the preview output must do.
    const layerOperations = decideLayerOperations({
      previousInstances: [rehearsedEnduroClock],
      previousPreviewClearedLayerIds: [],
      nextInstances: [rehearsedFinalClock],
      nextPreviewClearedLayerIds: [],
      layers: layersWithoutTheClock,
      drawnOutput: 'preview',
    });

    // Assert: still the instant swap; the out-then-in fallback is for the program page.
    expect(
      layerOperations,
      'a preview page must replace as a cut even on a layer it was never told about',
    ).toEqual([
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: enduroClockInstanceId,
            incomingInstance: rehearsedFinalClock,
            replacePolicy: 'cut',
          },
        ],
      },
    ]);
  });
});

describe('decideRebuildOperations for a page that draws the preview output', () => {
  it('disposes what was drawn and loads the composition, leaving a marked layer empty', () => {
    // Arrange: the enduro clock was being rehearsed when the connection dropped. When it
    // came back the server lists the final clock on air with nothing previewed over it,
    // and team 42's lower third on air on a layer marked "will be cleared".
    const instancesBeforeTheDrop = [rehearsedEnduroClock];
    const instancesAfterTheDrop = [
      finalClockOnAir,
      createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
    ];

    // Act: ask how a page that draws the preview output rebuilds its stage.
    const layerOperations = decideRebuildOperations({
      previousInstances: instancesBeforeTheDrop,
      previousPreviewClearedLayerIds: [],
      nextInstances: instancesAfterTheDrop,
      nextPreviewClearedLayerIds: ['lower-third'],
      drawnOutput: 'preview',
    });

    // Assert: the old rehearsal goes at once, the final clock on air appears without
    // animating in, and the marked lower-third layer is not drawn at all.
    expect(
      layerOperations,
      'a rebuild of the preview page must draw the screen after the take, with no animation',
    ).toEqual([
      {
        layerId: 'clock',
        operations: [
          { kind: 'disposeAtOnce', instanceId: enduroClockInstanceId },
          { kind: 'loadAndPlay', instance: finalClockOnAir, skipAnimation: true },
        ],
      },
    ]);
  });
});
