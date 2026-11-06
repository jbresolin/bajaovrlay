import type { Layer, ProgramHistory, ProgramHistoryShown } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/**
 * The tooltip of a Camadas row's "Desfazer": "Volta: "Tarja – Ana Souza"" or "Volta:
 * camada vazia", read from the layer's last remembered change. Undefined when the layer
 * remembers nothing, and then the row offers no "Desfazer".
 */
export function describeWhatUndoOnLayerBringsBack(
  programHistory: ProgramHistory,
  layerId: string,
): string | undefined {
  const layerHistory = programHistory.find((candidate) => candidate.layerId === layerId);
  const lastChange = layerHistory?.entries.at(-1);
  if (lastChange === undefined) {
    return undefined;
  }
  return ptBR.undo.whatComesBack(describeOneLayerComingBack(lastChange.shownBefore));
}

/**
 * The tooltip of "Desfazer última": every layer the newest change touched, in the order
 * Camadas lists them, each with what comes back ("Volta: Relógio: "Largada do Enduro" ·
 * Tarja: camada vazia"). The newest change is the highest change number among the last
 * entries of each layer, as the server reads it. Undefined when nothing is remembered.
 */
export function describeWhatUndoLastChangeBringsBack(
  programHistory: ProgramHistory,
  layersInCamadasOrder: Layer[],
): string | undefined {
  let newestChangeNumber = 0;
  for (const layerHistory of programHistory) {
    const lastChangeNumber = layerHistory.entries.at(-1)?.changeNumber ?? 0;
    newestChangeNumber = Math.max(newestChangeNumber, lastChangeNumber);
  }
  if (newestChangeNumber === 0) {
    return undefined;
  }

  const partsOfEachLayer: string[] = [];
  for (const layer of layersInCamadasOrder) {
    const layerHistory = programHistory.find((candidate) => candidate.layerId === layer.id);
    const lastChange = layerHistory?.entries.at(-1);
    if (lastChange?.changeNumber !== newestChangeNumber) {
      continue;
    }
    const whatComesBackText = describeOneLayerComingBack(lastChange.shownBefore);
    partsOfEachLayer.push(ptBR.undo.layerAndWhatComesBack(layer.name, whatComesBackText));
  }
  return ptBR.undo.whatComesBack(partsOfEachLayer.join(ptBR.undo.layersSeparator));
}

/** What one layer shows again: the item's label in quotes, or "camada vazia". */
function describeOneLayerComingBack(shownBefore: ProgramHistoryShown): string {
  if (shownBefore.kind === 'empty') {
    return ptBR.undo.layerComesBackEmpty;
  }
  return ptBR.undo.itemComesBack(shownBefore.itemLabel);
}
