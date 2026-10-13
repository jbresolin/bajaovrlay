/**
 * Deciding what to do on a page that draws the preview output (apps/renderer)
 *
 * What this module is for:
 *   Before taking an item the operator rehearses it: the server keeps it as an instance
 *   on the `preview` output, and the control page frames the renderer page at
 *   `/render/?target=preview&monitor=1` to show it. That page runs the same
 *   instanceReconciler as the page OBS loads, told to draw `preview` instead of `program`.
 *   Two things differ. It looks only at preview instances. And when one rehearsal
 *   replaces another on a layer, the swap is always the instant one (the `cut` way: no
 *   out-animation, no in-animation), whatever the layer's own replace policy says,
 *   because the preview is for looking at the next graphic, not for reviewing animations.
 *
 * What these tests prove, for a reconciler told to draw the preview output:
 *   - A preview instance on an empty layer is loaded and played, with its in-animation,
 *     exactly as a take is on the program page.
 *   - Program instances are ignored, coming, going, or sharing a layer with a rehearsal.
 *   - A take of the rehearsed item (the preview instance goes, a program instance with
 *     the same data comes) only stops and disposes the rehearsal.
 *   - A second rehearsal on an occupied layer is a replace carried out as `cut`, on a
 *     layer whose policy is `out-then-in`, on one whose policy is already `cut`, and on a
 *     layer the slice does not list.
 *   - Changed data on the same rehearsal is an update; a discarded rehearsal is stopped
 *     and disposed, as on the program page.
 *   - A rebuild after a hello disposes and loads preview instances only.
 *
 * What these tests deliberately do not cover:
 *   - The same decisions for the program output; instanceReconciler.test.ts and
 *     instanceReconciler.rebuild.test.ts.
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

const rehearsedEnduroClock = createRehearsalOf(createEnduroClockInstance());
const rehearsedFinalClock = createRehearsalOf(createFinalClockInstance());
const rehearsedUfprLowerThird = createRehearsalOf(
  createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
);
const rehearsedFeiLowerThird = createRehearsalOf(
  createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja'),
);

const previewSliceChangeScenarios = [
  // The everyday rehearsal: the operator previews the clock and nothing was previewed.
  {
    name: 'loads and plays a preview instance on an empty layer, with its in-animation',
    previousInstances: [],
    nextInstances: [rehearsedEnduroClock],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'loadAndPlay', instance: rehearsedEnduroClock, skipAnimation: false }],
      },
    ],
  },
  // Something was taken straight to air: the preview page must not show it.
  {
    name: 'ignores an instance taken on the program output',
    previousInstances: [],
    nextInstances: [createEnduroClockInstance()],
    expectedLayerOperations: [],
  },
  // The program layer was cleared: nothing was drawn for it here, so nothing to stop.
  {
    name: 'ignores an instance leaving the program output',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [],
    expectedLayerOperations: [],
  },
  // Preview and program share a layer id; the rehearsed final clock must not be
  // "replaced" by a clock that goes on air on the same layer.
  {
    name: 'keeps the preview instance when a program instance joins the same layer',
    previousInstances: [rehearsedFinalClock],
    nextInstances: [rehearsedFinalClock, createEnduroClockInstance()],
    expectedLayerOperations: [],
  },
  // "Tomar": the server removes the rehearsal and lists a new program instance with the
  // same data. For the preview page that is simply the rehearsal ending.
  {
    name: 'stops and disposes the preview instance when it is taken to program',
    previousInstances: [rehearsedFinalClock],
    nextInstances: [{ ...createFinalClockInstance(), id: 'c1f0a9d4-3b52-4e8a-9d67-0a4b8e2f5c13' }],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'stopAndDispose', instanceId: rehearsedFinalClock.id }],
      },
    ],
  },
  // The cursor moved to the next item on the clock layer, whose own policy is
  // out-then-in. On the preview page the swap is instant all the same.
  {
    name: 'replaces as a cut on a layer whose own policy is out-then-in',
    previousInstances: [rehearsedEnduroClock],
    nextInstances: [rehearsedFinalClock],
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
    nextInstances: [rehearsedFeiLowerThird],
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
    nextInstances: [
      {
        ...rehearsedEnduroClock,
        resolvedData: { sessionName: 'Enduro de Resistência', state: 'yellow', running: true },
      },
    ],
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
  // "Descartar": the rehearsal is gone and nothing replaces it.
  {
    name: 'stops and disposes a preview instance that was discarded',
    previousInstances: [rehearsedEnduroClock],
    nextInstances: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'stopAndDispose', instanceId: enduroClockInstanceId }],
      },
    ],
  },
];

describe('decideLayerOperations for a page that draws the preview output', () => {
  it.each(previewSliceChangeScenarios)('$name', (scenario) => {
    // Arrange: the instances the server listed last and the ones that just arrived.
    const { previousInstances, nextInstances, expectedLayerOperations } = scenario;

    // Act: ask what a page that draws the preview output must do on each layer.
    const layerOperations = decideLayerOperations({
      previousInstances,
      nextInstances,
      layers: layersOfTheStream,
      drawnOutput: 'preview',
    });

    // Assert: exactly the expected operations, layer by layer.
    expect(
      layerOperations,
      'a preview page must act on preview instances only, and replace them as a cut',
    ).toStrictEqual(expectedLayerOperations);
  });

  it('replaces as a cut when the layer is not in the layers slice', () => {
    // Arrange: a second rehearsal on the clock layer, but a layers slice without it.
    const layersWithoutTheClock = layersOfTheStream.filter((layer) => layer.id !== 'clock');

    // Act: ask what a page that draws the preview output must do.
    const layerOperations = decideLayerOperations({
      previousInstances: [rehearsedEnduroClock],
      nextInstances: [rehearsedFinalClock],
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
  it('disposes the rehearsal drawn before and loads only the rehearsals listed now', () => {
    // Arrange: the enduro clock was being rehearsed when the connection dropped; when it
    // came back the server lists team 42's lower third as the rehearsal, and the final
    // clock on air.
    const instancesBeforeTheDrop = [rehearsedEnduroClock];
    const instancesAfterTheDrop = [createFinalClockInstance(), rehearsedUfprLowerThird];

    // Act: ask how a page that draws the preview output rebuilds its stage.
    const layerOperations = decideRebuildOperations({
      previousInstances: instancesBeforeTheDrop,
      nextInstances: instancesAfterTheDrop,
      drawnOutput: 'preview',
    });

    // Assert: the old rehearsal goes at once, the new one appears without animating in,
    // and the clock that is on air is not drawn on the preview page.
    expect(
      layerOperations,
      'a rebuild of the preview page must leave program instances out',
    ).toEqual([
      {
        layerId: 'clock',
        operations: [{ kind: 'disposeAtOnce', instanceId: enduroClockInstanceId }],
      },
      {
        layerId: 'lower-third',
        operations: [
          { kind: 'loadAndPlay', instance: rehearsedUfprLowerThird, skipAnimation: true },
        ],
      },
    ]);
  });
});
