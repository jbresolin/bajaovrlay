/**
 * The layers of an output, and the order of the outputs (packages/shared)
 *
 * What this module is for:
 *   The server keeps the `layers` slice bottom to top by zIndex after every edit, and the
 *   pages and the renderer read one output's layers or list the outputs. These three
 *   small rules are shared so the server, Camadas and the renderer never disagree.
 *
 * What these tests prove:
 *   - The slice is sorted bottom to top, and a tie between two outputs keeps its order.
 *   - One output's layers are listed bottom to top, and an output with none gives none.
 *   - Program is listed first whatever its order, then the others by their order.
 *
 * What these tests deliberately do not cover:
 *   - Who sorts and when; the server's command tests in modules/outputs do.
 */
import { describe, expect, it } from 'vitest';

import type { Layer } from '../slices/layer.js';
import {
  listLayersOfOutputBottomToTop,
  listOutputsProgramFirst,
  sortLayersBottomToTop,
} from './layersOfOutputs.js';
import type { Output } from './output.js';

/** A layer of the given output at the given height; the rest does not matter here. */
function buildLayer(id: string, outputId: string, zIndex: number): Layer {
  return { id, outputId, name: id, zIndex, replacePolicy: 'out-then-in', persistent: false };
}

describe('sortLayersBottomToTop', () => {
  it('sorts by zIndex and keeps the order of a tie between outputs', () => {
    // Arrange: the program's lower third, the PiP's frame at 10 and the program's logo at 10.
    const layers = [
      buildLayer('lower-third', 'program', 40),
      buildLayer('moldura-pip', 'pip', 10),
      buildLayer('bug', 'program', 10),
    ];

    // Act: sort them.
    const sortedLayers = sortLayersBottomToTop(layers);

    // Assert: both 10s first, in the order they came, then the 40.
    expect(
      sortedLayers.map((layer) => layer.id),
      'bottom to top, a tie kept as it came',
    ).toEqual(['moldura-pip', 'bug', 'lower-third']);
  });
});

describe('listLayersOfOutputBottomToTop', () => {
  it("lists one output's layers bottom to top", () => {
    // Arrange: the PiP's caption above its frame, listed top first, and a program layer.
    const layers = [
      buildLayer('legenda-pip', 'pip', 20),
      buildLayer('bug', 'program', 10),
      buildLayer('moldura-pip', 'pip', 10),
    ];

    // Act: list the PiP's layers.
    const layersOfThePip = listLayersOfOutputBottomToTop(layers, 'pip');

    // Assert: the frame, then the caption; nothing of program.
    expect(
      layersOfThePip.map((layer) => layer.id),
      "only the PiP's layers, bottom to top",
    ).toEqual(['moldura-pip', 'legenda-pip']);
  });

  it('lists nothing for an output with no layer', () => {
    // Arrange: program's logo alone.
    const layers = [buildLayer('bug', 'program', 10)];

    // Act: list a new output's layers.
    const layersOfTheNewOutput = listLayersOfOutputBottomToTop(layers, 'camera-2');

    // Assert: none.
    expect(layersOfTheNewOutput, 'a new output starts with no layer').toEqual([]);
  });
});

describe('listOutputsProgramFirst', () => {
  it('puts program first, then the others by their order', () => {
    // Arrange: program moved to the end by a reorder, and two other outputs.
    const outputs: Output[] = [
      { outputId: 'camera-2', name: 'Câmera 2', order: 1 },
      { outputId: 'program', name: 'Programa', order: 2 },
      { outputId: 'pip', name: 'PiP', order: 0 },
    ];

    // Act: list them.
    const outputsInOrder = listOutputsProgramFirst(outputs);

    // Assert: program, then PiP (0) and Câmera 2 (1).
    expect(
      outputsInOrder.map((output) => output.outputId),
      'program leads, the others follow their order',
    ).toEqual(['program', 'pip', 'camera-2']);
  });
});
