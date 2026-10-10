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
 *   - The same instance with the same data needs nothing at all.
 *   - The same instance with changed data gets an update holding only the changed fields;
 *     a field that disappeared is sent as `undefined`.
 *   - A different instance on an occupied layer is a replace, carrying that layer's
 *     replace policy (and `out-then-in` when the layer is unknown).
 *   - An instance that is gone is stopped and disposed.
 *   - Two layers changing at once get two separate lists, one per layer.
 *   - Instances on the `preview` output are ignored, coming or going.
 *   - After a reconnect, everything drawn is disposed at once and everything on air is
 *     loaded again with its in-animation skipped.
 *
 * What these tests deliberately do not cover:
 *   - Calling the graphics (load, playAction, ...); e2e/lifecycle.e2e.ts checks that in
 *     a real browser.
 *   - A change of `currentStep`; stepping through a graphic arrives with BAJAOVRLAY-12.
 */
import type { Instance, Layer } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { decideLayerOperations, decideRebuildOperations } from './instanceReconciler.js';

const enduroClockInstanceId = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';
const finalClockInstanceId = 'b84f6c1e-0a3d-4c59-8e7b-5d2a9f31c602';
const ufprLowerThirdInstanceId = '2c9e7f40-6b1a-4d83-9f25-e1a0c4b7d915';
const feiLowerThirdInstanceId = '91d0a3b7-5e2c-47f6-a8c4-3b6e0f2d7a48';

/** The two layers these tests use: the clock animates out then in, the lower third cuts. */
const layersOfTheStream: Layer[] = [
  { id: 'clock', name: 'Relógio', zIndex: 30, replacePolicy: 'out-then-in', persistent: true },
  { id: 'lower-third', name: 'Legenda', zIndex: 40, replacePolicy: 'cut', persistent: false },
];

/** Builds the race clock of the enduro, on air on the clock layer under green flag. */
function createEnduroClockInstance(changes: Partial<Instance> = {}): Instance {
  return {
    id: enduroClockInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: { sessionName: 'Enduro de Resistência', state: 'green', running: true },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T13:00:00.000Z',
    ...changes,
  };
}

/** Builds the race clock of the final heat, a different take on the same clock layer. */
function createFinalClockInstance(): Instance {
  return createEnduroClockInstance({
    id: finalClockInstanceId,
    resolvedData: { sessionName: 'Final', state: 'pre', running: false },
    takenAt: '2026-10-09T15:30:00.000Z',
  });
}

/** Builds a lower third naming one team, on the lower-third layer. */
function createTeamLowerThirdInstance(
  instanceId: string,
  teamNumber: number,
  teamName: string,
): Instance {
  return {
    id: instanceId,
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { teamNumber, teamName },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T13:05:00.000Z',
  };
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
  it.each(sliceChangeScenarios)(
    '$name',
    ({ previousInstances, nextInstances, expectedLayerOperations }) => {
      // Arrange: the instances drawn last and the ones that just arrived, from the table.

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
    },
  );

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

describe('decideRebuildOperations', () => {
  it('disposes what was drawn and loads what is on air with the animation skipped', () => {
    // Arrange: the enduro clock was drawn before the connection dropped; when it came
    // back, the server says the final clock and a lower third are on air.
    const instancesDrawnBeforeTheDrop = [createEnduroClockInstance()];
    const instancesOnAirNow = [
      createFinalClockInstance(),
      createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
    ];

    // Act: ask how to rebuild the stage.
    const layerOperations = decideRebuildOperations({
      previousInstances: instancesDrawnBeforeTheDrop,
      nextInstances: instancesOnAirNow,
    });

    // Assert: the old clock goes at once, and both graphics appear without animating in.
    expect(
      layerOperations,
      'a rebuild must dispose everything local, then load each on-air instance with skipAnimation',
    ).toEqual([
      {
        layerId: 'clock',
        operations: [
          { kind: 'disposeAtOnce', instanceId: enduroClockInstanceId },
          { kind: 'loadAndPlay', instance: createFinalClockInstance(), skipAnimation: true },
        ],
      },
      {
        layerId: 'lower-third',
        operations: [
          {
            kind: 'loadAndPlay',
            instance: createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
            skipAnimation: true,
          },
        ],
      },
    ]);
  });

  it('rebuilds the same instance too, because the page may have lost it', () => {
    // Arrange: the same clock before and after; nothing changed on the server.
    const instancesBeforeAndAfter = [createEnduroClockInstance()];

    // Act: ask how to rebuild the stage.
    const layerOperations = decideRebuildOperations({
      previousInstances: instancesBeforeAndAfter,
      nextInstances: instancesBeforeAndAfter,
    });

    // Assert: it is disposed and loaded again; a rebuild never assumes what is drawn.
    expect(
      layerOperations,
      'a rebuild must reload an unchanged instance instead of trusting the page',
    ).toEqual([
      {
        layerId: 'clock',
        operations: [
          { kind: 'disposeAtOnce', instanceId: enduroClockInstanceId },
          { kind: 'loadAndPlay', instance: createEnduroClockInstance(), skipAnimation: true },
        ],
      },
    ]);
  });

  it('leaves preview instances out of a rebuild', () => {
    // Arrange: only a rehearsal clock exists, on the preview output.
    const rehearsalOnly = [createEnduroClockInstance({ target: 'preview' })];

    // Act: ask how to rebuild the stage.
    const layerOperations = decideRebuildOperations({
      previousInstances: [],
      nextInstances: rehearsalOnly,
    });

    // Assert: nothing to do; /render/ draws the program output only.
    expect(layerOperations, 'a preview instance must never be drawn on /render/').toEqual([]);
  });
});
