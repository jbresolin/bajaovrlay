import type { TakePreviewCommand } from '@bajaovrlay/shared';

import { refuseTakeOfEmptyPreview, refuseUnknownLayer } from '../commandRefusals.js';
import { removePreviewClearedMarkerOfLayer } from './previewMarkersAndDiscards.js';
import { clearProgramOfMarkedLayer, takePreviewInstanceToProgram } from './previewPromotion.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { moveRundownCursorsPastItemsTakenTogether } from './rundownCursor.js';

/**
 * takePreview ("Tomar" on one line under the Prévia monitor): makes the program output
 * of one layer what Prévia shows for it.
 * - With a preview instance on the layer, that instance goes to program exactly as it
 *   was seen (see takePreviewInstanceToProgram: the data as previewed, stamped fields
 *   stamped again with this command's moment), the cursor follows takeItem's rule, and the
 *   preview is removed.
 * - With no preview but the layer marked "will be cleared", the layer's program output
 *   is cleared (as clearLayer would clear it on program) and the marker is taken off.
 * Either way the layer's marker is gone afterwards.
 *
 * Refused if the layer does not exist, if it has neither a preview nor a marker
 * (LAYER_PREVIEW_EMPTY), or for any reason takeGraphic refuses; nothing changes then,
 * and the preview stays.
 */
export function reduceTakePreview(
  slices: SlicesChangedByCommands,
  command: TakePreviewCommand,
  context: ReducerContext,
): ReducerOutcome {
  const layer = slices.layers.find((candidate) => candidate.id === command.layerId);
  if (layer === undefined) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const previewInstance = slices.instances.find(
    (instance) => instance.layerId === command.layerId && instance.target === 'preview',
  );

  if (previewInstance === undefined) {
    const isLayerMarkedToBeCleared = slices.previewClearedLayerIds.includes(layer.id);
    if (!isLayerMarkedToBeCleared) {
      return { status: 'refused', error: refuseTakeOfEmptyPreview(layer.name) };
    }
    return { status: 'applied', slices: clearProgramOfMarkedLayer(slices, layer.id) };
  }

  const promotion = takePreviewInstanceToProgram(slices, previewInstance, context);
  if (promotion.status === 'refused') {
    return promotion;
  }
  // A layer with a preview has no marker (every preview takes it off); taking it off
  // here as well keeps the rule "after a take the layer is not marked" true regardless.
  const markersAfter = removePreviewClearedMarkerOfLayer(
    promotion.slices.previewClearedLayerIds,
    layer.id,
  );
  // takeItem's cursor rule; a preview made by hand has no item and moves no cursor.
  const takenItemIds = previewInstance.itemId === undefined ? [] : [previewInstance.itemId];
  const rundownsAfter = moveRundownCursorsPastItemsTakenTogether(
    promotion.slices.rundowns,
    promotion.slices.items,
    takenItemIds,
  );
  return {
    status: 'applied',
    slices: {
      ...promotion.slices,
      previewClearedLayerIds: markersAfter,
      rundowns: rundownsAfter,
    },
  };
}
