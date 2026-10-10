/**
 * Deciding what to do on each layer (apps/renderer)
 *
 * What this module is for:
 *   The renderer mirrors the server's `instances` slice: whatever the slice says is on a
 *   layer of the `program` output must be on screen. instanceReconciler compares the slice
 *   the renderer drew last with the one that just arrived and answers, layer by layer,
 *   with a list of named operations. It never touches the page; instancePlayer does that.
 *
 * What these tests prove:
 *   - A new instance on an empty layer is loaded and played, with its in-animation.
 *   - The same instance with the same data needs nothing at all, also when its status
 *     changed (the server marking it on air after the renderer's own report).
 *   - The same instance with changed data gets an update holding only the changed fields;
 *     a field that disappeared is sent as `undefined`. A list counts as changed when
 *     its contents or their order differ, not merely because it is a new list object.
 *   - A different instance on an occupied layer is a replace, carrying that layer's
 *     replace policy (and `out-then-in` when the layer is unknown).
 *   - An instance that is gone is stopped and disposed.
 *   - Two layers changing at once get two separate lists, one per layer.
 *   - Instances on the `preview` output are ignored, coming or going.
 *
 * What these tests deliberately do not cover:
 *   - Rebuilding the whole stage after a reconnect; instanceReconciler.rebuild.test.ts.
 *   - Calling the graphics (load, playAction, ...); e2e/lifecycle.e2e.ts checks that in
 *     a real browser.
 *   - A change of `currentStep`; stepping through a graphic is a later task.
 */
import { describe, expect, it } from 'vitest';

import { decideLayerOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createFinalClockInstance,
  createTeamLowerThirdInstance,
  enduroClockInstanceId,
  feiLowerThirdInstanceId,
  layersOfTheStream,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';

/** Builds the enduro clock with the numbers of the three leading teams, in race order. */
function createEnduroClockInstanceWithTopThree(topThreeTeamNumbers: number[]) {
  return createEnduroClockInstance({
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      running: true,
      topThreeTeamNumbers,
    },
  });
}

const sliceChangeScenarios = [
  // The everyday take: the operator puts the clock on an empty layer.
  {
    name: 'loads and plays a new instance on an empty layer',
    previousInstances: [],
    nextInstances: [createEnduroClockInstance()],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          { kind: 'loadAndPlay', instance: createEnduroClockInstance(), skipAnimation: false },
        ],
      },
    ],
  },
  // Another slice changed, or the server re-sent the same instances: nothing may flicker.
  {
    name: 'does nothing when the same instance has the same data',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [createEnduroClockInstance()],
    expectedLayerOperations: [],
  },
  // The renderer reported the clock on air and the server changed its status: the same
  // instance comes back with only `status` different, and the graphic must not be touched.
  {
    name: 'does nothing when only the status of the same instance changed',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [createEnduroClockInstance({ status: 'on-air' })],
    expectedLayerOperations: [],
  },
  // The flag went yellow: only `state` changed, so only `state` is sent to the graphic.
  {
    name: 'updates the same instance with only the fields that changed',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [
      createEnduroClockInstance({
        resolvedData: { sessionName: 'Enduro de Resistência', state: 'yellow', running: true },
      }),
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
  // A field appeared (the leader finished a first lap) and nothing else changed.
  {
    name: 'sends a field that is new in the data',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [
      createEnduroClockInstance({
        resolvedData: {
          sessionName: 'Enduro de Resistência',
          state: 'green',
          running: true,
          lapsCompletedByLeader: 1,
        },
      }),
    ],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'updateData',
            instanceId: enduroClockInstanceId,
            changedData: { lapsCompletedByLeader: 1 },
          },
        ],
      },
    ],
  },
  // A field disappeared: the graphic is told it has no value any more, instead of
  // silently keeping the old one on screen.
  {
    name: 'sends a field that disappeared from the data as undefined',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [
      createEnduroClockInstance({
        resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
      }),
    ],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'updateData',
            instanceId: enduroClockInstanceId,
            changedData: { running: undefined },
          },
        ],
      },
    ],
  },
  // Every message from the server is read afresh, so a list that did not change still
  // arrives as a new list object. It must be compared by its contents, or every resend
  // of the slice would send the graphic a needless update.
  {
    name: 'does nothing when a list in the data has the same contents',
    previousInstances: [createEnduroClockInstanceWithTopThree([42, 7, 13])],
    nextInstances: [createEnduroClockInstanceWithTopThree([42, 7, 13])],
    expectedLayerOperations: [],
  },
  // Team 7 overtook team 42: the same numbers in another order are a real change.
  {
    name: 'updates when the order of a list changes',
    previousInstances: [createEnduroClockInstanceWithTopThree([42, 7, 13])],
    nextInstances: [createEnduroClockInstanceWithTopThree([7, 42, 13])],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'updateData',
            instanceId: enduroClockInstanceId,
            changedData: { topThreeTeamNumbers: [7, 42, 13] },
          },
        ],
      },
    ],
  },
  // A new take on the clock layer, which swaps out-then-in: the policy travels with the
  // operation so the player knows to animate the old clock out first.
  {
    name: 'replaces with out-then-in on a layer that has that policy',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [createFinalClockInstance()],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: enduroClockInstanceId,
            incomingInstance: createFinalClockInstance(),
            replacePolicy: 'out-then-in',
          },
        ],
      },
    ],
  },
  // The lower-third layer cuts: the same kind of change must carry that layer's policy.
  {
    name: 'replaces with cut on a layer that has that policy',
    previousInstances: [createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR')],
    nextInstances: [createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja')],
    expectedLayerOperations: [
      {
        layerId: 'lower-third',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: ufprLowerThirdInstanceId,
            incomingInstance: createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja'),
            replacePolicy: 'cut',
          },
        ],
      },
    ],
  },
  // The operator cleared the layer: the clock animates out and is thrown away.
  {
    name: 'stops and disposes an instance that is gone',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'stopAndDispose', instanceId: enduroClockInstanceId }],
      },
    ],
  },
  // A macro changed two layers in one go: each layer gets its own list, so a slow
  // animation on one can never hold up the other.
  {
    name: 'answers with one independent list per layer when two layers change at once',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR')],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'stopAndDispose', instanceId: enduroClockInstanceId }],
      },
      {
        layerId: 'lower-third',
        operations: [
          {
            kind: 'loadAndPlay',
            instance: createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
            skipAnimation: false,
          },
        ],
      },
    ],
  },
  // The operator rehearses a clock on the preview output: /render/ shows program only.
  {
    name: 'ignores an instance taken on the preview output',
    previousInstances: [],
    nextInstances: [createEnduroClockInstance({ target: 'preview' })],
    expectedLayerOperations: [],
  },
  // The rehearsal ends: nothing was drawn for it, so there is nothing to stop.
  {
    name: 'ignores an instance leaving the preview output',
    previousInstances: [createEnduroClockInstance({ target: 'preview' })],
    nextInstances: [],
    expectedLayerOperations: [],
  },
  // Preview and program share a layer id; only the program one counts, so the program
  // clock is not "replaced" by the rehearsal of the next one.
  {
    name: 'keeps the program instance when a preview instance joins the same layer',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [
      createEnduroClockInstance(),
      { ...createFinalClockInstance(), target: 'preview' as const },
    ],
    expectedLayerOperations: [],
  },
];

describe('decideLayerOperations', () => {
  it.each(sliceChangeScenarios)('$name', (scenario) => {
    // Arrange: the instances drawn last and the ones that just arrived, from the row.
    const { previousInstances, nextInstances, expectedLayerOperations } = scenario;

    // Act: ask what to do on each layer.
    const layerOperations = decideLayerOperations({
      previousInstances,
      nextInstances,
      layers: layersOfTheStream,
    });

    // Assert: exactly the expected operations, layer by layer.
    expect(
      layerOperations,
      'the operations must be exactly what this change calls for',
    ).toStrictEqual(expectedLayerOperations);
  });

  it('replaces with out-then-in when the layer is not in the layers slice', () => {
    // Arrange: a replace on the clock layer, but a layers slice that does not list it.
    const layersWithoutTheClock = layersOfTheStream.filter((layer) => layer.id !== 'clock');

    // Act: ask what to do.
    const layerOperations = decideLayerOperations({
      previousInstances: [createEnduroClockInstance()],
      nextInstances: [createFinalClockInstance()],
      layers: layersWithoutTheClock,
    });

    // Assert: the safest policy is used, the one where two graphics never overlap.
    expect(
      layerOperations,
      'an unknown layer must fall back to the out-then-in replace policy',
    ).toEqual([
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: enduroClockInstanceId,
            incomingInstance: createFinalClockInstance(),
            replacePolicy: 'out-then-in',
          },
        ],
      },
    ]);
  });
});
