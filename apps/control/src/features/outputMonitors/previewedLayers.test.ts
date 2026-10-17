/**
 * The lines under the "Prévia" monitor, and the key each is drawn with (apps/control)
 *
 * What this module is for:
 *   listPreviewedLayers turns the server's slices into the lines under the "Prévia"
 *   monitor: one per preview instance and one per layer marked "vai limpar", lowest layer
 *   first. React draws each line with a key, and two lines with the same key would be
 *   mixed up (one of them drawn twice, or a "Tomar" on the wrong line). The review of
 *   BAJAOVRLAY-36 asked for keys that cannot collide, so each key is built from the
 *   output, the layer and the instance's id, or the word "mark" for a marked layer.
 *
 * What these tests prove:
 *   - A preview and a mark on the same layer (which the server never makes, but a page
 *     must survive) give two lines with different keys.
 *   - The key of a preview line changes when a new preview replaces the old one on the
 *     same layer, so React draws the new line as a new line.
 *
 * What these tests deliberately do not cover:
 *   - What the lines say and their buttons: PreviewedLayersList.test.tsx and
 *     PreviewedLayersListTakeAll.test.tsx draw them on the page.
 */
import type { Instance, Layer } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { listPreviewedLayers } from './previewedLayers';

// The clock was previewed at 10:00 on the Saturday of the endurance race.
const momentOfThePreview = '2026-10-10T13:00:00.000Z';

/** The clock layer as the server seeds it. */
function buildClockLayer(): Layer {
  return {
    id: 'clock',
    name: 'Relógio',
    zIndex: 30,
    replacePolicy: 'out-then-in',
    persistent: true,
  };
}

/** A race clock previewed by hand on the clock layer, with this id. */
function buildRaceClockPreviewWithId(instanceId: string): Instance {
  return {
    id: instanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'preview',
    resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
    currentStep: 0,
    status: 'loading',
    takenAt: momentOfThePreview,
    previewOrigin: 'manual',
  };
}

describe('the keys of the lines under the "Prévia" monitor', () => {
  it('gives a preview and a mark on the same layer two different keys', () => {
    // Arrange: a clock previewed on the clock layer, and the same layer marked.
    const slices = {
      layers: [buildClockLayer()],
      graphics: [],
      items: [],
      instances: [buildRaceClockPreviewWithId('3b9e2f70-5c1d-4a8e-b6f3-0d2c9e7a1b44')],
      previewClearedLayerIds: ['clock'],
    };

    // Act: list the lines.
    const lines = listPreviewedLayers(slices);

    // Assert: two lines, each with a key of its own that says what it is.
    expect(
      lines.map((line) => line.lineKey),
      'a preview line and a mark line must never share a key',
    ).toEqual(['preview:clock:3b9e2f70-5c1d-4a8e-b6f3-0d2c9e7a1b44', 'mark:clock']);
  });

  it('gives a new preview on the same layer a new key', () => {
    // Arrange: the same layer previewed twice, one preview after the other.
    const slicesWithTheFirstPreview = {
      layers: [buildClockLayer()],
      graphics: [],
      items: [],
      instances: [buildRaceClockPreviewWithId('3b9e2f70-5c1d-4a8e-b6f3-0d2c9e7a1b44')],
      previewClearedLayerIds: [],
    };
    const slicesWithTheSecondPreview = {
      ...slicesWithTheFirstPreview,
      instances: [buildRaceClockPreviewWithId('e1c47a0b-92d6-4f35-8b1e-6a0d3c5f7e29')],
    };

    // Act: list the lines of each.
    const keyOfTheFirstLine = listPreviewedLayers(slicesWithTheFirstPreview)[0]?.lineKey;
    const keyOfTheSecondLine = listPreviewedLayers(slicesWithTheSecondPreview)[0]?.lineKey;

    // Assert: the two lines have different keys.
    expect(keyOfTheSecondLine, 'a preview that replaced another is a new line').not.toBe(
      keyOfTheFirstLine,
    );
  });
});
