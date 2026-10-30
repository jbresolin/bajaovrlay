import type { Layer } from '../slices/layer.js';
import { type Output, programOutputId } from './output.js';

/**
 * The layers in the order the `layers` slice keeps them: bottom to top by zIndex. The
 * sort is stable, so two layers of different outputs at one height keep the order they
 * had. The server sorts after every edit, as the seed was always sorted, so whatever
 * reads the slice in order (Camadas, the renderer's containers) still reads it bottom
 * to top.
 */
export function sortLayersBottomToTop(layers: Layer[]): Layer[] {
  return [...layers].sort((lowerLayer, higherLayer) => lowerLayer.zIndex - higherLayer.zIndex);
}

/** The layers of one output, bottom to top; none for an output that has no layer. */
export function listLayersOfOutputBottomToTop(layers: Layer[], outputId: string): Layer[] {
  const layersOfTheOutput = layers.filter((layer) => layer.outputId === outputId);
  return sortLayersBottomToTop(layersOfTheOutput);
}

/**
 * The outputs as the pages list them: program first, then the others by their order.
 * Program leads whatever its order, because it is what OBS's main source shows.
 */
export function listOutputsProgramFirst(outputs: Output[]): Output[] {
  const program = outputs.filter((output) => output.outputId === programOutputId);
  const others = outputs
    .filter((output) => output.outputId !== programOutputId)
    .sort((earlierOutput, laterOutput) => earlierOutput.order - laterOutput.order);
  return [...program, ...others];
}
