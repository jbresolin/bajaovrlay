/**
 * The preview page showing what stays on air and what a take will clear (apps/renderer)
 *
 * What this module is for:
 *   "Prévia" shows the screen as it will look after the take, so on a layer with nothing
 *   previewed the preview page draws what is on air there, and on a layer marked "will be
 *   cleared" (`previewClearedLayerIds`) it draws nothing (previewComposition.ts). The
 *   reconciler of the preview page compares that composition, before and after each
 *   delivery, with the very rules of the program page; only a replace is always a `cut`.
 *   These tests follow a program instance the preview page shows, and the markers, through
 *   the changes the operator and the server make.
 *
 * What these tests prove, for a reconciler told to draw the preview output:
 *   - A program instance on a layer with no preview is loaded and played with its
 *     in-animation, updated when updateInstanceData changes it on air, and stopped with
 *     its out-animation when it leaves the air or when its layer is marked.
 *   - A take on air over it, or a preview arriving on its layer, is a replace carried out
 *     as a cut: the program instance and the incoming one have different ids, so the
 *     reconciler decides a replace, never a stop and a load with an empty layer between.
 *   - A marker that goes away puts the program instance back with its in-animation; a take
 *     on air on a marked layer, and the take of a marked layer, leave it empty.
 *   - Marking a previewed layer stops the preview; a program instance coming or going
 *     under a preview changes nothing.
 *   - "Tomar" and "Descartar" of a preview swap in the program instance as a cut.
 *
 * What these tests deliberately do not cover:
 *   - Previews alone (a first preview, a second one, an update, a discard over an empty
 *     layer, a rebuild); instanceReconciler.preview.test.ts.
 *   - The composition rule row by row; previewComposition.test.ts.
 *   - The program page, which never reads the markers; instanceReconciler.test.ts.
 *   - What the player then calls on the graphics; instancePlayer.preview.test.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { decideLayerOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createFinalClockInstance,
  enduroClockInstanceId,
  finalClockInstanceId,
  layersOfTheStream,
} from './instancesOnAir.testSupport.js';

/** Builds the same instance as a rehearsal: on the preview output instead of on air. */
function createRehearsalOf(instance: Instance): Instance {
  return { ...instance, target: 'preview' };
}

const enduroClockOnAir = createEnduroClockInstance();
const finalClockOnAir = createFinalClockInstance();
const rehearsedFinalClock = createRehearsalOf(createFinalClockInstance());
// What "Tomar" makes of the rehearsed final clock: the same data on program, under the
// new id the server gives every take.
const finalClockTakenFromPreview: Instance = {
  ...createFinalClockInstance(),
  id: 'c1f0a9d4-3b52-4e8a-9d67-0a4b8e2f5c13',
};

const compositionChangeScenarios = [
  // Something was taken straight to air on a layer with no preview: a take would leave it
  // there, so the preview page shows it, animating in as it does on air.
  {
    name: 'loads and plays a program instance taken on a layer with no preview',
    previousInstances: [],
    previousPreviewClearedLayerIds: [],
    nextInstances: [enduroClockOnAir],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'loadAndPlay', instance: enduroClockOnAir, skipAnimation: false }],
      },
    ],
  },
  // "Edição rápida" changes the clock on air (updateInstanceData, same id): the preview
  // page shows that clock, so it gets the same update as the program page.
  {
    name: 'updates a program instance it shows when its data changes on air',
    previousInstances: [enduroClockOnAir],
    previousPreviewClearedLayerIds: [],
    nextInstances: [
      {
        ...enduroClockOnAir,
        resolvedData: { sessionName: 'Enduro de Resistência', state: 'yellow', running: true },
      },
    ],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          { kind: 'updateData', instanceId: enduroClockInstanceId, changedData: { state: 'yellow' } },
        ],
      },
    ],
  },
  // Another clock is taken on air over the one the preview page shows: a different id, so
  // a replace, carried out as a cut like every replace on this page.
  {
    name: 'replaces as a cut a program instance it shows when a take replaces it on air',
    previousInstances: [enduroClockOnAir],
    previousPreviewClearedLayerIds: [],
    nextInstances: [finalClockOnAir],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: enduroClockInstanceId,
            incomingInstance: finalClockOnAir,
            replacePolicy: 'cut',
          },
        ],
      },
    ],
  },
  // The operator previews the final clock on the layer whose enduro clock the page shows:
  // the ids differ, so the reconciler decides a replace, not a stop and a load with a gap.
  {
    name: 'replaces as a cut a program instance it shows when a preview arrives on its layer',
    previousInstances: [enduroClockOnAir],
    previousPreviewClearedLayerIds: [],
    nextInstances: [enduroClockOnAir, rehearsedFinalClock],
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
  // "Prévia: limpar" on the clock layer: nothing replaces the clock, so it is a stop with
  // its out-animation, as a discarded preview is (only a replace skips animation here).
  {
    name: 'stops and disposes a program instance it shows when its layer is marked',
    previousInstances: [enduroClockOnAir],
    previousPreviewClearedLayerIds: [],
    nextInstances: [enduroClockOnAir],
    nextPreviewClearedLayerIds: ['clock'],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'stopAndDispose', instanceId: enduroClockInstanceId }],
      },
    ],
  },
  // The clock is cleared on air while nothing is previewed there: the page follows.
  {
    name: 'stops and disposes a program instance it shows when it leaves the air',
    previousInstances: [enduroClockOnAir],
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
  // The marker is discarded (stopPreview): the layer will keep its clock after all, so the
  // clock comes back on the preview page with its in-animation, as a first preview does.
  {
    name: 'loads and plays the program instance again when the marker of its layer goes away',
    previousInstances: [enduroClockOnAir],
    previousPreviewClearedLayerIds: ['clock'],
    nextInstances: [enduroClockOnAir],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'loadAndPlay', instance: enduroClockOnAir, skipAnimation: false }],
      },
    ],
  },
  // A take on air on a marked layer: the layer stays empty on the preview page.
  {
    name: 'leaves a marked layer empty when a take replaces its program instance on air',
    previousInstances: [enduroClockOnAir],
    previousPreviewClearedLayerIds: ['clock'],
    nextInstances: [finalClockOnAir],
    nextPreviewClearedLayerIds: ['clock'],
    expectedLayerOperations: [],
  },
  // "Tomar" on a marked layer: the server clears program and removes the marker. Nothing
  // was drawn there and nothing is drawn now.
  {
    name: 'does nothing when a marked layer is taken (program cleared, marker removed)',
    previousInstances: [enduroClockOnAir],
    previousPreviewClearedLayerIds: ['clock'],
    nextInstances: [],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [],
  },
  // "Prévia: limpar" on a layer whose preview the page shows: the server removes the
  // preview and adds the marker, so the preview stops with its out-animation.
  {
    name: 'stops and disposes the preview instance when its layer is marked instead',
    previousInstances: [enduroClockOnAir, rehearsedFinalClock],
    previousPreviewClearedLayerIds: [],
    nextInstances: [enduroClockOnAir],
    nextPreviewClearedLayerIds: ['clock'],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'stopAndDispose', instanceId: finalClockInstanceId }],
      },
    ],
  },
  // A program instance joins a layer that has a preview: the preview is what a take shows.
  {
    name: 'keeps the preview instance when a program instance joins the same layer',
    previousInstances: [rehearsedFinalClock],
    previousPreviewClearedLayerIds: [],
    nextInstances: [rehearsedFinalClock, enduroClockOnAir],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [],
  },
  // The program instance under a preview leaves the air: the preview still covers it.
  {
    name: 'keeps the preview instance when the program instance of its layer leaves the air',
    previousInstances: [enduroClockOnAir, rehearsedFinalClock],
    previousPreviewClearedLayerIds: [],
    nextInstances: [rehearsedFinalClock],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [],
  },
  // "Tomar": the server removes the rehearsal and lists a new program instance with the
  // same data and a new id. The page now shows the program one, swapped in as a cut.
  {
    name: 'replaces the preview instance as a cut with the program instance its take made',
    previousInstances: [rehearsedFinalClock],
    previousPreviewClearedLayerIds: [],
    nextInstances: [finalClockTakenFromPreview],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: finalClockInstanceId,
            incomingInstance: finalClockTakenFromPreview,
            replacePolicy: 'cut',
          },
        ],
      },
    ],
  },
  // "Descartar" over a clock on air: the page goes back to showing the clock on air.
  {
    name: 'replaces as a cut a discarded preview instance with the program instance under it',
    previousInstances: [enduroClockOnAir, rehearsedFinalClock],
    previousPreviewClearedLayerIds: [],
    nextInstances: [enduroClockOnAir],
    nextPreviewClearedLayerIds: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: finalClockInstanceId,
            incomingInstance: enduroClockOnAir,
            replacePolicy: 'cut',
          },
        ],
      },
    ],
  },
];

describe('decideLayerOperations for a preview page showing what stays on air', () => {
  it.each(compositionChangeScenarios)('$name', (scenario) => {
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
      'the preview page must follow the screen after the take: replace as a cut, otherwise as on air',
    ).toStrictEqual(expectedLayerOperations);
  });
});
