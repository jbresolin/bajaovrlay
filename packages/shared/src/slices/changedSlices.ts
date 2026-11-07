import { z } from 'zod';

import { SliceNameSchema, type Slices, SlicesSchema } from './slices.js';

/**
 * The names of the slices a `slice` or `slices` message carries whole: every slice but
 * `dataSnapshots`, whose changes go source by source in a `dataSnapshot` message, so a
 * poll of one source does not resend every source's data (BAJAOVRLAY-40). `hello` still
 * carries every slice, `dataSnapshots` included.
 */
export const SliceNameSentWholeSchema = SliceNameSchema.exclude(['dataSnapshots']);

/** One of SliceNameSentWholeSchema's values. */
export type SliceNameSentWhole = z.infer<typeof SliceNameSentWholeSchema>;

/**
 * The slices one state change changed, by name: a part of Slices, each value checked by
 * that slice's own schema. `strict`, so a misspelt name is refused instead of dropped
 * (the change it carried would be lost without a word), and so is `dataSnapshots`, which
 * is never sent whole after the hello (see SliceNameSentWholeSchema). An empty group is
 * refused: a state change always changes something, so an empty one is a server bug.
 */
export const ChangedSlicesSchema = SlicesSchema.omit({ dataSnapshots: true })
  .partial()
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
 * kind of list (or, for `obs`, the object) that belongs to it.
 */
export function mergeChangedSlicesIntoSlices(slices: Slices, changedSlices: ChangedSlices): Slices {
  return {
    outputs: changedSlices.outputs ?? slices.outputs,
    layers: changedSlices.layers ?? slices.layers,
    graphics: changedSlices.graphics ?? slices.graphics,
    instances: changedSlices.instances ?? slices.instances,
    previewClearedLayerIds: changedSlices.previewClearedLayerIds ?? slices.previewClearedLayerIds,
    instanceBindings: changedSlices.instanceBindings ?? slices.instanceBindings,
    programHistory: changedSlices.programHistory ?? slices.programHistory,
    rundowns: changedSlices.rundowns ?? slices.rundowns,
    items: changedSlices.items ?? slices.items,
    quickFirePanels: changedSlices.quickFirePanels ?? slices.quickFirePanels,
    macros: changedSlices.macros ?? slices.macros,
    macroRuns: changedSlices.macroRuns ?? slices.macroRuns,
    macroStops: changedSlices.macroStops ?? slices.macroStops,
    obs: changedSlices.obs ?? slices.obs,
    triggers: changedSlices.triggers ?? slices.triggers,
    triggerActivity: changedSlices.triggerActivity ?? slices.triggerActivity,
    dataSources: changedSlices.dataSources ?? slices.dataSources,
    // Never in a group: a snapshot arrives source by source (`dataSnapshot` message).
    dataSnapshots: slices.dataSnapshots,
    overrides: changedSlices.overrides ?? slices.overrides,
    recordings: changedSlices.recordings ?? slices.recordings,
    events: changedSlices.events ?? slices.events,
    eventRules: changedSlices.eventRules ?? slices.eventRules,
    teams: changedSlices.teams ?? slices.teams,
    people: changedSlices.people ?? slices.people,
    sponsors: changedSlices.sponsors ?? slices.sponsors,
    scheduleSlots: changedSlices.scheduleSlots ?? slices.scheduleSlots,
    media: changedSlices.media ?? slices.media,
    eventLog: changedSlices.eventLog ?? slices.eventLog,
  };
}
