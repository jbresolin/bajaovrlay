import type { Instance } from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from './reducerTypes.js';

// Adding and removing "will be cleared" markers (`previewClearedLayerIds`), and
// discarding previews: the small steps every command uses on what Prévia shows. Each one hands back
// the very same array when it changes nothing, so the store saves, logs and broadcasts
// nothing for a command that leaves the markers or the instances as they were.

/** The markers with this layer's added at the end, or the same array if it is there. */
export function addPreviewClearedMarker(markers: string[], layerId: string): string[] {
  if (markers.includes(layerId)) {
    return markers;
  }
  return [...markers, layerId];
}

/** The markers without this layer's, or the same array if it was not marked. */
export function removePreviewClearedMarkerOfLayer(markers: string[], layerId: string): string[] {
  if (!markers.includes(layerId)) {
    return markers;
  }
  return markers.filter((markedLayerId) => markedLayerId !== layerId);
}

/** No marker at all, or the same array if there was none. */
export function removeEveryPreviewClearedMarker(markers: string[]): string[] {
  if (markers.length === 0) {
    return markers;
  }
  return [];
}

/** The instances without any on the preview output, or the same array if none was. */
export function removeEveryPreviewInstance(instances: Instance[]): Instance[] {
  const programInstances = instances.filter((instance) => instance.target !== 'preview');
  if (programInstances.length === instances.length) {
    return instances;
  }
  return programInstances;
}

/**
 * The slices with Prévia emptied: no preview instance and no marker; program, the
 * rundowns and everything else untouched. runMacro and previewMacro start with this.
 */
export function discardEveryPreviewAndMarker(
  slices: SlicesChangedByCommands,
): SlicesChangedByCommands {
  const instancesAfter = removeEveryPreviewInstance(slices.instances);
  const markersAfter = removeEveryPreviewClearedMarker(slices.previewClearedLayerIds);
  const isAnythingDiscarded =
    instancesAfter !== slices.instances || markersAfter !== slices.previewClearedLayerIds;
  if (!isAnythingDiscarded) {
    return slices;
  }
  return { ...slices, instances: instancesAfter, previewClearedLayerIds: markersAfter };
}
