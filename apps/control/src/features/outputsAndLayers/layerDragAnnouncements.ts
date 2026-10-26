import type { Layer } from '@bajaovrlay/shared';
import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';

import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.outputs;

/** What a screen reader reads on a layer's "Mover" handle: how to drag with the keyboard. */
export const layerDragInstructionsForScreenReaders: ScreenReaderInstructions = {
  draggable: texts.dragInstructions,
};

/**
 * The sentences a screen reader hears while a layer row is dragged, naming each layer by
 * its name (dnd-kit speaks of ids, and its own sentences are in English).
 */
export function buildLayerDragAnnouncements(layersOfTheOutput: Layer[]): Announcements {
  // Falls back to the id for a layer deleted by someone else in the middle of a drag.
  function findLayerName(layerId: UniqueIdentifier): string {
    return layersOfTheOutput.find((layer) => layer.id === layerId)?.name ?? String(layerId);
  }

  return {
    onDragStart: ({ active }) => texts.dragPickedUp(findLayerName(active.id)),
    onDragOver: ({ active, over }) =>
      over === null ? undefined : texts.dragOver(findLayerName(active.id), findLayerName(over.id)),
    onDragEnd: ({ active }) => texts.dragDropped(findLayerName(active.id)),
    onDragCancel: ({ active }) => texts.dragCancelled(findLayerName(active.id)),
  };
}
