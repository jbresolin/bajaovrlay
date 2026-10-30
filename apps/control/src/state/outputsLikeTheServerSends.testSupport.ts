// Test support: the state the server sends once João added a PiP output (BAJAOVRLAY-49),
// for the tests of "Saídas e camadas", Camadas, the monitors and the layer pickers. Every
// builder returns new objects; nothing here keeps state between calls.
import { type Layer, type Slices, sortLayersBottomToTop } from '@bajaovrlay/shared';

import { buildSlicesWithNothingOnAir } from './slicesLikeTheServerSends.testSupport';

/** The PiP's frame around the camera box, at the bottom of its output. */
export function buildPipFrameLayer(): Layer {
  return {
    id: 'moldura-pip',
    outputId: 'pip',
    name: 'Moldura',
    zIndex: 10,
    replacePolicy: 'cut',
    persistent: true,
  };
}

/** The PiP's caption with live data, above the frame. */
export function buildPipCaptionLayer(): Layer {
  return {
    id: 'legenda-pip',
    outputId: 'pip',
    name: 'Legenda',
    zIndex: 20,
    replacePolicy: 'out-then-in',
    persistent: false,
  };
}

/**
 * Right after boot, nothing on air, with program (the seven seeded layers) and PiP
 * (frame and caption). The race clock, registered, defaults to program's clock layer.
 */
export function buildSlicesWithThePipOutput(): Slices {
  const slicesOfProgramAlone = buildSlicesWithNothingOnAir();
  return {
    ...slicesOfProgramAlone,
    outputs: [...slicesOfProgramAlone.outputs, { outputId: 'pip', name: 'PiP', order: 1 }],
    layers: sortLayersBottomToTop([
      ...slicesOfProgramAlone.layers,
      buildPipFrameLayer(),
      buildPipCaptionLayer(),
    ]),
  };
}
