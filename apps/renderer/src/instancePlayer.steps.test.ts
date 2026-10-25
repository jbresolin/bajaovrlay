// @vitest-environment jsdom
/**
 * Playing a graphic's steps (apps/renderer)
 *
 * What this module is for:
 *   A graphic may come in steps: the podium shows its head at the take, then one place per
 *   "Próximo" (BAJAOVRLAY-47). The server raises the instance's `currentStep`; the
 *   reconciler turns that into a `goToStep` operation, and the player asks the graphic on
 *   screen for that step with playAction({ goto }). A graphic loaded when it is already
 *   past step 0 (OBS reloading the page in the middle of the podium) is played straight at
 *   its step, so the places already revealed come back.
 *
 * What these tests prove:
 *   - A take plays step 0.
 *   - `goToStep` plays the step asked on the graphic already on its layer, with its
 *     in-animation, and loads nothing again.
 *   - A rebuild of an instance at step 2 plays step 2, with no animation.
 *   - `goToStep` for an instance that is not on its layer (it failed to load) does nothing.
 *
 * What these tests deliberately do not cover:
 *   - Which operations a change of `currentStep` produces; instanceReconciler.test.ts.
 *   - What the podium does with each step; packages/graphics/podium.
 */
import type { Graphic, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { LayerOperations } from './instanceReconciler.js';
import {
  createStageWithPlayer,
  createTakeOf,
  graphicsOfTheStream,
  waitForQueuedOperations,
} from './stageWithPlayer.testSupport.js';

/** The podium package, with its four steps, beside the stream's other graphics. */
const graphicsWithThePodium: Graphic[] = [
  ...graphicsOfTheStream,
  {
    id: 'podium',
    manifest: { id: 'baja-podium', name: 'Pódio', main: 'podium.js', stepCount: 4 },
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  },
];

/** The enduro's podium on the fullscreen layer, at the step given. */
function createPodiumInstance(currentStep: number): Instance {
  return {
    id: 'podio-do-enduro',
    layerId: 'fullscreen',
    graphicId: 'podium',
    target: 'program',
    resolvedData: { title: 'PÓDIO' },
    currentStep,
    status: 'on-air',
    takenAt: '2026-11-14T19:30:00.000Z',
  };
}

/** The operation "Próximo" becomes on the podium's layer. */
function createGoToStepOfThePodium(step: number): LayerOperations[] {
  return [
    {
      layerId: 'fullscreen',
      operations: [{ kind: 'goToStep', instanceId: 'podio-do-enduro', step }],
    },
  ];
}

describe('the steps of a graphic', () => {
  it('plays step 0 at the take, then the step "Próximo" asks for, on the same graphic', async () => {
    // Arrange: the podium taken and played.
    const { instancePlayer, recording } = createStageWithPlayer();
    instancePlayer.runLayerOperations(createTakeOf(createPodiumInstance(0)), graphicsWithThePodium);
    await waitForQueuedOperations();

    // Act: the server moved it to step 1.
    instancePlayer.runLayerOperations(createGoToStepOfThePodium(1), graphicsWithThePodium);
    await waitForQueuedOperations();

    // Assert: one load, then step 0, then step 1, both animated.
    expect(recording.lifecycleCalls, 'the step plays on the graphic already on air').toEqual([
      'podio-do-enduro: load',
      'podio-do-enduro: playAction',
      'podio-do-enduro: playAction',
    ]);
    expect(recording.stepsPlayed, 'step 0 at the take, then step 1').toEqual([0, 1]);
  });

  it('plays a rebuilt instance straight at its step, with no animation', async () => {
    // Arrange: an empty stage, as after OBS reloaded the page in the middle of the podium.
    const { instancePlayer, recording } = createStageWithPlayer();
    const rebuildOfThePodiumAtStep2: LayerOperations[] = [
      {
        layerId: 'fullscreen',
        operations: [
          { kind: 'loadAndPlay', instance: createPodiumInstance(2), skipAnimation: true },
        ],
      },
    ];

    // Act: rebuild the stage.
    instancePlayer.runLayerOperations(rebuildOfThePodiumAtStep2, graphicsWithThePodium);
    await waitForQueuedOperations();

    // Assert: played at step 2 at once, so the 3rd and 2nd places come back.
    expect(recording.lifecycleCalls, 'loaded, then played without animation').toEqual([
      'podio-do-enduro: load',
      'podio-do-enduro: playAction (skipAnimation)',
    ]);
    expect(recording.stepsPlayed, 'the step the server keeps').toEqual([2]);
  });

  it('does nothing for a step of an instance that is not on its layer', async () => {
    // Arrange: an empty stage (the podium's load failed, so it never reached its layer).
    const { instancePlayer, recording } = createStageWithPlayer();

    // Act: the server moved the podium to step 1 anyway.
    instancePlayer.runLayerOperations(createGoToStepOfThePodium(1), graphicsWithThePodium);
    await waitForQueuedOperations();

    // Assert: no call at all; there is no graphic to step.
    expect(recording.lifecycleCalls, 'nothing to play').toEqual([]);
  });
});
