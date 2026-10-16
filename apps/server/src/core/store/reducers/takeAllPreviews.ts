import { refuseUnknownLayer } from '../commandRefusals.js';
import { refuseTakeAllAtLayer, refuseTakeAllWithNothingInPreview } from '../previewRefusals.js';
import { buildContextForInstanceOnLayer } from './instanceIdForEachLayer.js';
import { removeEveryPreviewClearedMarker } from './previewClearedMarkers.js';
import { clearProgramOfMarkedLayer, takePreviewInstanceToProgram } from './previewPromotion.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * takeAllPreviews ("Tomar tudo"): makes program what Prévia shows, in one reducer call,
 * so the store saves, logs and broadcasts it as ONE change and OBS never shows a
 * half-taken set. For each layer, lowest z-index first:
 * - a preview instance there is taken exactly as takePreview takes it (the data as seen,
 *   its stamped fields stamped again with this command's moment through the wall-clock
 *   check, the item's id kept, the rundown cursor rule of takeItem);
 * - otherwise a "will be cleared" marker there clears that layer's program output.
 * Then no preview and no marker is left.
 *
 * Deliberate: the layers go in z-order, lowest first (layers with the same z-index in
 * the order the layers slice lists them), so the result does not depend on the order the
 * instances happen to sit in. It matters for the cursor: with two previewed items of one
 * rundown, each take judges the cursor as the take before left it, so the cursor moves on
 * once per item taken at the cursor and ends after the last of them in z-order.
 * Each new program instance gets the store's new instance id followed by its layer id
 * (instanceIdForEachLayer.ts).
 *
 * Refused, with nothing changed, when there is no preview and no marker
 * (NOTHING_IN_PREVIEW), or when any one layer cannot be taken: a preview or marker on a
 * layer the server does not list, or a take that takeGraphic refuses (the graphic gone,
 * the data or a stamp no longer fitting its schema). Deliberate: one refused layer
 * refuses the whole set, with a message naming that layer and carrying its reason,
 * because a half-taken set on air is worse than none.
 */
export function reduceTakeAllPreviews(
  slices: SlicesChangedByCommands,
  context: ReducerContext,
): ReducerOutcome {
  const previewInstances = slices.instances.filter((instance) => instance.target === 'preview');
  const isPreviewEmpty =
    previewInstances.length === 0 && slices.previewClearedLayerIds.length === 0;
  if (isPreviewEmpty) {
    return { status: 'refused', error: refuseTakeAllWithNothingInPreview() };
  }

  // A preview or marker on a layer that is not listed would be skipped by the loop below,
  // which goes through the listed layers: refuse it first, naming it by its id.
  const layerIdsShownInPreview = [
    ...previewInstances.map((instance) => instance.layerId),
    ...slices.previewClearedLayerIds,
  ];
  const unlistedLayerId = layerIdsShownInPreview.find(
    (layerId) => !slices.layers.some((layer) => layer.id === layerId),
  );
  if (unlistedLayerId !== undefined) {
    return {
      status: 'refused',
      error: refuseTakeAllAtLayer(unlistedLayerId, refuseUnknownLayer(unlistedLayerId)),
    };
  }

  const layersLowestFirst = [...slices.layers].sort(
    (lowerLayer, higherLayer) => lowerLayer.zIndex - higherLayer.zIndex,
  );
  let slicesSoFar = slices;
  for (const layer of layersLowestFirst) {
    const previewInstanceOnLayer = slicesSoFar.instances.find(
      (instance) => instance.layerId === layer.id && instance.target === 'preview',
    );
    const isLayerMarkedToBeCleared = slicesSoFar.previewClearedLayerIds.includes(layer.id);

    if (previewInstanceOnLayer !== undefined) {
      const promotion = takePreviewInstanceToProgram(
        slicesSoFar,
        previewInstanceOnLayer,
        buildContextForInstanceOnLayer(context, layer.id),
      );
      if (promotion.status === 'refused') {
        return { status: 'refused', error: refuseTakeAllAtLayer(layer.name, promotion.error) };
      }
      slicesSoFar = promotion.slices;
    } else if (isLayerMarkedToBeCleared) {
      slicesSoFar = clearProgramOfMarkedLayer(slicesSoFar, layer.id);
    }
  }

  // Every marker was carried out above; this also drops one that sat beside a preview on
  // the same layer, which no command makes, so that "nothing is left" holds regardless.
  const markersAfter = removeEveryPreviewClearedMarker(slicesSoFar.previewClearedLayerIds);
  return { status: 'applied', slices: { ...slicesSoFar, previewClearedLayerIds: markersAfter } };
}
