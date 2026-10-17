import type { ReducerContext } from './reducerTypes.js';

/**
 * The context to hand the take or preview of one layer, for the commands that make one
 * instance on each of several layers (takeAllPreviews, previewMacro): its new instance
 * id is the store's one new instance id, a hyphen, and the layer id. The store hands a
 * reducer a single new id per command, and a reducer may not make ids itself (it must
 * stay pure).
 * Deliberate: a command leaves at most one new instance per layer and output (a later
 * take on the same layer and output replaces the earlier one), so the layer id keeps the
 * ids of one command apart, and the store's id, new for every command, keeps them apart
 * from every other command's.
 * What could go wrong: these ids are not UUIDs, so nothing may ever check an instance id
 * for that shape (InstanceSchema asks only for a non-empty text).
 */
export function buildContextForInstanceOnLayer(
  context: ReducerContext,
  layerId: string,
): ReducerContext {
  return { ...context, newInstanceId: `${context.newInstanceId}-${layerId}` };
}
