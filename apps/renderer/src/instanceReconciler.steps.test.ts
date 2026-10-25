/**
 * Deciding to play another step (apps/renderer)
 *
 * What this module is for:
 *   "Próximo" moves the instance on a layer to its next OGraf step on the server (the
 *   podium's places, BAJAOVRLAY-47): the same instance comes back with a higher
 *   `currentStep`. instanceReconciler answers that with a `goToStep` operation, which the
 *   player turns into playAction({ goto }) on the graphic already on screen.
 *
 * What these tests prove:
 *   - The same instance at another step, with the same data, gets one goToStep.
 *   - The same instance with new data and another step gets the update first, then the
 *     step, so the step plays with the data it belongs to.
 *   - A step that goes back with new data (the server keeping a bracket within the steps
 *     its new rounds have, BAJAOVRLAY-25) is played the same way: the data, then the
 *     lower step.
 *
 * What these tests deliberately do not cover:
 *   - Playing the step; instancePlayer.steps.test.ts.
 *   - The other changes of a slice; instanceReconciler.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { decideLayerOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  enduroClockInstanceId,
  layersOfTheStream,
} from './instancesOnAir.testSupport.js';

const stepChangeScenarios = [
  // "Próximo": only the step changed, so the graphic on screen plays that step.
  {
    name: 'plays the next step when only the step of the same instance changed',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [createEnduroClockInstance({ currentStep: 1 })],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [{ kind: 'goToStep', instanceId: enduroClockInstanceId, step: 1 }],
      },
    ],
  },
  // A refresh and a "Próximo" arrived in one delivery: the data goes first.
  {
    name: 'updates the data first, then plays the step, when both changed',
    previousInstances: [createEnduroClockInstance()],
    nextInstances: [
      createEnduroClockInstance({
        currentStep: 1,
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
          { kind: 'goToStep', instanceId: enduroClockInstanceId, step: 1 },
        ],
      },
    ],
  },
  // A refresh that shrank a bracket's rounds: the server put it back on its last step
  // (BAJAOVRLAY-25), so the step goes down with the new data, and plays after it.
  {
    name: 'updates the data first, then plays the lower step, when the server brought the step back',
    previousInstances: [createEnduroClockInstance({ currentStep: 5 })],
    nextInstances: [
      createEnduroClockInstance({
        currentStep: 2,
        resolvedData: { sessionName: 'Enduro de Resistência', state: 'checkered', running: true },
      }),
    ],
    expectedLayerOperations: [
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'updateData',
            instanceId: enduroClockInstanceId,
            changedData: { state: 'checkered' },
          },
          { kind: 'goToStep', instanceId: enduroClockInstanceId, step: 2 },
        ],
      },
    ],
  },
];

describe('decideLayerOperations, for a step', () => {
  it.each(stepChangeScenarios)('$name', (scenario) => {
    // Arrange: the instances drawn last and the ones that just arrived, from the row.
    const { previousInstances, nextInstances, expectedLayerOperations } = scenario;

    // Act: ask what the page that draws the program output must do on each layer.
    const layerOperations = decideLayerOperations({
      previousInstances,
      previousPreviewClearedLayerIds: [],
      nextInstances,
      nextPreviewClearedLayerIds: [],
      layers: layersOfTheStream,
      drawnOutput: 'program',
    });

    // Assert: exactly the expected operations, in order.
    expect(layerOperations, 'a step change must play that step').toStrictEqual(
      expectedLayerOperations,
    );
  });
});
