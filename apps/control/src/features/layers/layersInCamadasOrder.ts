import {
  type Layer,
  listLayersOfOutputBottomToTop,
  listOutputsProgramFirst,
  type Output,
} from '@bajaovrlay/shared';

/**
 * The layers in the order Camadas draws them: bottom of the screen stack first, and with
 * more than one output (BAJAOVRLAY-49) program's layers first, then each other output's.
 * Anything that lists layers beside Camadas ("Desfazer última"'s tooltip) reads them in
 * this order, so the two never disagree.
 */
export function listLayersInCamadasOrder(layers: Layer[], outputs: Output[]): Layer[] {
  const isOneOutputOnly = outputs.length <= 1;
  if (isOneOutputOnly) {
    // Copied before sorting: the list in the store belongs to the store.
    return [...layers].sort((oneLayer, otherLayer) => oneLayer.zIndex - otherLayer.zIndex);
  }
  return listOutputsProgramFirst(outputs).flatMap((output) =>
    listLayersOfOutputBottomToTop(layers, output.outputId),
  );
}
