// What is on a layer, as the routes that colour buttons read it: GET /layers/status
// (BAJAOVRLAY-28) and GET /state/layer (BAJAOVRLAY-56). One place finds the instance and
// its item's label, so the two can never disagree about what is on air; each route words
// "no name" its own way (null, or "") in a one-line wrapper of its own.
import type { Instance, Slices } from '@bajaovrlay/shared';

/**
 * The instance on one layer for one target (program or preview), if any; a layer holds
 * at most one per target. Any status counts (loading, on air, stopping, failed):
 * something is on that layer's screen, or meant to be.
 */
export function findInstanceOnLayer(
  instances: Instance[],
  layerId: string,
  target: Instance['target'],
): Instance | undefined {
  return instances.find((instance) => instance.layerId === layerId && instance.target === target);
}

/**
 * The label of the item an instance came from. Undefined with no instance, an instance
 * made with no item, or one whose item was deleted while it was on air.
 */
export function readItemLabelOfInstance(
  slices: Slices,
  instance: Instance | undefined,
): string | undefined {
  if (instance?.itemId === undefined) {
    return undefined;
  }
  const item = slices.items.find((candidate) => candidate.id === instance.itemId);
  return item?.label;
}
