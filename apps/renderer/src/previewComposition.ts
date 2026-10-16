/**
 * Decides which instances the preview page draws: the screen as it will look after the
 * take (João's rule for "Prévia"). Per layer, the first of these that applies:
 *   1. the preview instance on that layer;
 *   2. nothing, when the layer is marked "will be cleared" (`previewClearedLayerIds`);
 *   3. the program instance on that layer.
 * So a previewed layer never shows its program instance, and a layer nobody touched in
 * preview shows what is on air, because a take leaves it as it is.
 *
 * Pure, and the only place this rule lives: instanceReconciler.ts composes both the
 * previous and the next delivery with it on the preview page, then diffs the two as on any
 * page. The page OBS loads never calls it.
 *
 * What could go wrong, and what is done about it:
 *   - The server never lists a preview and a marker on one layer (previewing a layer
 *     removes its marker, marking it removes its preview). If it ever did, rule 1 wins: the
 *     preview instance is what the take would put on air.
 *   - The server keeps one instance per layer and output. If a slice ever listed two, the
 *     later one in the list is drawn, the rule the reconciler has always used.
 *   - An instance on a layer the layers slice does not list is kept like any other; the
 *     player logs it and leaves it undrawn, as it did before this composition existed.
 */
import type { Instance } from '@bajaovrlay/shared';

/**
 * Answers the instances the preview page draws, at most one per layer, in the order the
 * slice lists them. `previewClearedLayerIds` is the server's slice of layers marked
 * "will be cleared" in preview.
 */
export function selectInstancesForPreviewComposition(delivery: {
  instances: Instance[];
  previewClearedLayerIds: string[];
}): Instance[] {
  const previewInstanceByLayer = findLastInstanceOfEachLayerOnOutput(delivery.instances, 'preview');
  const programInstanceByLayer = findLastInstanceOfEachLayerOnOutput(delivery.instances, 'program');
  const markedLayerIds = new Set(delivery.previewClearedLayerIds);

  /** The three rules, for one layer: the instance drawn there, or undefined for nothing. */
  function decideInstanceDrawnOnLayer(layerId: string): Instance | undefined {
    const previewInstance = previewInstanceByLayer.get(layerId);
    if (previewInstance !== undefined) {
      return previewInstance;
    }
    const isMarkedWillBeCleared = markedLayerIds.has(layerId);
    if (isMarkedWillBeCleared) {
      return undefined;
    }
    return programInstanceByLayer.get(layerId);
  }

  // Walking the slice itself (not the layers) keeps its order and keeps an instance on a
  // layer the layers slice does not list. The identity check drops every instance its
  // layer's rule did not choose.
  const composedInstances: Instance[] = [];
  for (const instance of delivery.instances) {
    const instanceDrawnOnItsLayer = decideInstanceDrawnOnLayer(instance.layerId);
    if (instanceDrawnOnItsLayer === instance) {
      composedInstances.push(instance);
    }
  }
  return composedInstances;
}

/** Maps each layer id to its instance on one output; the later one wins if two are listed. */
function findLastInstanceOfEachLayerOnOutput(
  instances: Instance[],
  output: Instance['target'],
): Map<string, Instance> {
  const instanceByLayer = new Map<string, Instance>();
  for (const instance of instances) {
    if (instance.target === output) {
      instanceByLayer.set(instance.layerId, instance);
    }
  }
  return instanceByLayer;
}
