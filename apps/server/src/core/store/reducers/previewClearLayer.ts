import type { PreviewClearLayerCommand } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../commandRefusals.js';
import { addPreviewClearedMarker } from './previewMarkersAndDiscards.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * previewClearLayer ("Prévia: limpar"): marks one layer "will be cleared", so the
 * preview page draws that layer empty, as the screen will be after the take. Any preview
 * instance on the layer is thrown away, because a layer is either previewed or marked,
 * never both. Program is not touched: takePreview of the layer, or takeAllPreviews,
 * clears it later.
 * Deliberate: a layer with nothing on program may be marked too (the marker then clears
 * nothing at the take); the control page offers the button only where something is on
 * air, and a macro's preview marks every clearLayer step it meets (previewMacro.ts).
 * Marking a layer that is already marked and not previewed hands back the same slices.
 * Refused if the layer does not exist.
 */
export function reducePreviewClearLayer(
  slices: SlicesChangedByCommands,
  command: PreviewClearLayerCommand,
): ReducerOutcome {
  const layerExists = slices.layers.some((layer) => layer.id === command.layerId);
  if (!layerExists) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }

  const instancesKept = slices.instances.filter((instance) => {
    const isThisLayersPreview =
      instance.layerId === command.layerId && instance.target === 'preview';
    return !isThisLayersPreview;
  });
  const markersAfter = addPreviewClearedMarker(slices.previewClearedLayerIds, command.layerId);

  const hasRemovedAPreview = instancesKept.length !== slices.instances.length;
  const hasAddedTheMarker = markersAfter !== slices.previewClearedLayerIds;
  if (!hasRemovedAPreview && !hasAddedTheMarker) {
    return { status: 'applied', slices };
  }
  return {
    status: 'applied',
    slices: {
      ...slices,
      instances: hasRemovedAPreview ? instancesKept : slices.instances,
      previewClearedLayerIds: markersAfter,
    },
  };
}
