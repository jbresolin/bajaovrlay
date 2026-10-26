/**
 * The renderer address of an output, and the height of a new layer (apps/control)
 *
 * What this module is for:
 *   Each output card on "Saídas e camadas" shows the address to paste into an OBS browser
 *   source, and "Adicionar camada" puts the new layer on top of its output.
 *
 * What these tests prove:
 *   - Program's address is /render/ with nothing after it (as every older OBS setup has
 *     it), another output's carries `?output=<id>`.
 *   - A new layer goes ten above the output's top layer, or at 10 on an empty output.
 *
 * What these tests deliberately do not cover:
 *   - The copy button and the card; OutputsAndLayersPage tests.
 */
import type { Layer } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { findHeightOfANewLayer } from './heightOfANewLayer';
import { buildRendererAddressOfOutput } from './rendererAddressOfOutput';

/** A layer of the PiP at the given height. */
function buildPipLayer(id: string, zIndex: number): Layer {
  return { id, outputId: 'pip', name: id, zIndex, replacePolicy: 'cut', persistent: false };
}

describe('buildRendererAddressOfOutput', () => {
  it('gives program the plain /render/ address', () => {
    // Arrange: the server on the production machine of the event.
    const origin = 'http://192.168.0.10:3000';

    // Act: the address of program.
    const address = buildRendererAddressOfOutput(origin, 'program');

    // Assert: no query, exactly as OBS has it today.
    expect(address, 'program keeps the address OBS already has').toBe(
      'http://192.168.0.10:3000/render/',
    );
  });

  it('gives another output its id in the address', () => {
    // Arrange: the same server.
    const origin = 'http://192.168.0.10:3000';

    // Act: the address of the PiP.
    const address = buildRendererAddressOfOutput(origin, 'pip');

    // Assert: the PiP's own address.
    expect(address, 'the PiP has an address of its own').toBe(
      'http://192.168.0.10:3000/render/?output=pip',
    );
  });
});

describe('findHeightOfANewLayer', () => {
  it('puts a new layer ten above the top one', () => {
    // Arrange: the PiP's frame (10) and caption (20).
    const layers = [buildPipLayer('moldura-pip', 10), buildPipLayer('legenda-pip', 20)];

    // Act: find the height of a new layer.
    const height = findHeightOfANewLayer(layers);

    // Assert: on top.
    expect(height, 'a new layer goes on top of its output').toBe(30);
  });

  it('puts the first layer of an output at 10', () => {
    // Arrange: an output with no layer yet.

    // Act: find the height of its first layer.
    const height = findHeightOfANewLayer([]);

    // Assert: 10, as the seed starts.
    expect(height, 'the first layer starts at 10').toBe(10);
  });
});
