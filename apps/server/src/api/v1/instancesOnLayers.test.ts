/**
 * The instance on a layer, and its item's label (apps/server)
 *
 * What this module is for:
 *   Two routes read what is on a layer: GET /layers/status for Companion and the D200's
 *   GET /state/layer (BAJAOVRLAY-56). Both find the instance on a layer for a target
 *   (program or preview) and the label of its item through these two helpers. Each route
 *   then words "no name" its own way (null there, "" here) in a one-line wrapper.
 *
 * What these tests prove (on the slices of a real race-day store):
 *   - The instance on program and the one in preview of one layer are found apart.
 *   - A layer with nothing on it for a target gives no instance.
 *   - The label is the item's; no instance, or an instance whose item was deleted, gives
 *     no label (undefined), never a guess.
 *
 * What these tests deliberately do not cover:
 *   - Each route's answer ("" or null); layerButtonStateRoute.test.ts and
 *     layersStatusRoute.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { createOpenAppWithTheRaceDay } from './buttonStateOnTheApp.testSupport.js';
import { applyOrThrow } from './commandApiOnTheApp.testSupport.js';
import { findInstanceOnLayer, readItemLabelOfInstance } from './instancesOnLayers.js';

describe('findInstanceOnLayer', () => {
  it('finds the instance on program and the one in preview of the same layer apart', () => {
    // Arrange: the corner clock on air and the green flag in Prévia, both on the bug layer.
    const { stateStore, raceDay } = createOpenAppWithTheRaceDay();
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
    applyOrThrow(stateStore, { type: 'previewItem', itemId: raceDay.greenFlagCornerItemId });
    const { instances } = stateStore.readAllSlices();

    // Act: look for each target on the bug layer.
    const instanceOnAir = findInstanceOnLayer(instances, 'bug', 'program');
    const instanceInPreview = findInstanceOnLayer(instances, 'bug', 'preview');

    // Assert: each target has its own item's instance.
    expect(instanceOnAir?.itemId, 'program holds the corner clock').toBe(raceDay.cornerClockItemId);
    expect(instanceInPreview?.itemId, 'Prévia holds the green flag').toBe(
      raceDay.greenFlagCornerItemId,
    );
  });

  it('finds nothing on a layer with nothing on it for that target', () => {
    // Arrange: only the corner clock on air, on the bug layer.
    const { stateStore, raceDay } = createOpenAppWithTheRaceDay();
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
    const { instances } = stateStore.readAllSlices();

    // Act: look at the bug layer's Prévia and at the empty fullscreen layer's program.
    const bugPreview = findInstanceOnLayer(instances, 'bug', 'preview');
    const fullscreenProgram = findInstanceOnLayer(instances, 'fullscreen', 'program');

    // Assert: neither has an instance.
    expect([bugPreview, fullscreenProgram], 'nothing is there').toEqual([undefined, undefined]);
  });
});

describe('readItemLabelOfInstance', () => {
  it("reads the label of the instance's item", () => {
    // Arrange: the corner clock on air.
    const { stateStore, raceDay } = createOpenAppWithTheRaceDay();
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
    const slices = stateStore.readAllSlices();
    const instanceOnAir = findInstanceOnLayer(slices.instances, 'bug', 'program');

    // Act: read the label of its item.
    const label = readItemLabelOfInstance(slices, instanceOnAir);

    // Assert: the label the operator gave the button.
    expect(label, 'the corner clock by its label').toBe('Relógio no canto');
  });

  it('gives no label for no instance, or for an instance whose item was deleted', () => {
    // Arrange: the corner clock on air, then its button deleted from "Atalhos".
    const { stateStore, raceDay } = createOpenAppWithTheRaceDay();
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
    applyOrThrow(stateStore, { type: 'deleteItem', itemId: raceDay.cornerClockItemId });
    const slices = stateStore.readAllSlices();
    const orphanInstance = findInstanceOnLayer(slices.instances, 'bug', 'program');

    // Act: read a label with no instance, and the orphan instance's label.
    const labelOfNothing = readItemLabelOfInstance(slices, undefined);
    const labelOfTheOrphan = readItemLabelOfInstance(slices, orphanInstance);

    // Assert: neither has a label, and the orphan is still on air.
    expect(orphanInstance, 'the graphic stays on air after its item is deleted').toBeDefined();
    expect([labelOfNothing, labelOfTheOrphan], 'no label in either case').toEqual([
      undefined,
      undefined,
    ]);
  });
});
