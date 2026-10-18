import { z } from 'zod';

import { type Slices, SlicesSchema } from './slices.js';

/**
 * The slices one state change changed, by name: a part of Slices, each value checked by
 * that slice's own schema. `strict`, so a misspelt name is refused instead of dropped
 * (the change it carried would be lost without a word). An empty group is refused: a
 * state change always changes something, so an empty one is a server bug.
 */
export const ChangedSlicesSchema = SlicesSchema.partial()
  .strict()
  .refine((changedSlices) => Object.keys(changedSlices).length > 0, {
    message: 'a group of changed slices must carry at least one slice',
  });

/** A group of changed slices, after validation. */
export type ChangedSlices = z.infer<typeof ChangedSlicesSchema>;

/**
 * Lays the slices of one state change over the slices a client had, all in one step, so
 * no one ever sees some of them new and the others old. A slice the group does not carry
 * is kept as the very same list, so whatever reads only that slice does not redraw.
 * Written out one slice per line on purpose: the compiler checks each name stores the
 * kind of list that belongs to it.
 */
export function mergeChangedSlicesIntoSlices(slices: Slices, changedSlices: ChangedSlices): Slices {
  return {
    layers: changedSlices.layers ?? slices.layers,
    graphics: changedSlices.graphics ?? slices.graphics,
    instances: changedSlices.instances ?? slices.instances,
    previewClearedLayerIds: changedSlices.previewClearedLayerIds ?? slices.previewClearedLayerIds,
    rundowns: changedSlices.rundowns ?? slices.rundowns,
    items: changedSlices.items ?? slices.items,
    quickFirePanels: changedSlices.quickFirePanels ?? slices.quickFirePanels,
    macros: changedSlices.macros ?? slices.macros,
    macroRuns: changedSlices.macroRuns ?? slices.macroRuns,
    dataSources: changedSlices.dataSources ?? slices.dataSources,
    dataSnapshots: changedSlices.dataSnapshots ?? slices.dataSnapshots,
    recordings: changedSlices.recordings ?? slices.recordings,
    eventLog: changedSlices.eventLog ?? slices.eventLog,
  };
}
