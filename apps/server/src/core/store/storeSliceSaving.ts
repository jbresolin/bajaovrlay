// Which slices the store saves, and how: the slices a command may change, the one saved
// row by row in its own table, the ones kept in memory only, and how the rows to save
// and the whole state are built from them. Split from createStateStore.ts, whose job is
// the single command path.
import type { Slices } from '@bajaovrlay/shared';

import { buildRowOfTheTriggerPause } from '../../modules/triggers/index.js';
import type { SliceRow } from '../db/tables.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';

/** The slices a reducer may change, in the order changes are reported. */
export const sliceNamesChangedByCommands = [
  'outputs',
  'layers',
  'graphics',
  'instances',
  'previewClearedLayerIds',
  'instanceBindings',
  'programHistory',
  'rundowns',
  'items',
  'quickFirePanels',
  'macros',
  'macroRuns',
  'macroStops',
  'obs',
  'triggers',
  'triggerActivity',
  'dataSources',
  'dataSnapshots',
  'overrides',
  'bracketMatchFocuses',
  'recordings',
  'events',
  'eventRules',
  'teams',
  'people',
  'sponsors',
  'scheduleSlots',
  'media',
] as const;

// The slice saved one row per source in its own table (data_snapshots) instead of as one
// row of the slices table: a poll of one source must not rewrite every source's data.
const sliceNameSavedOneRowPerSource: keyof SlicesChangedByCommands = 'dataSnapshots';

// The slices that live in memory only and are never written to the database: a macro
// run is something happening now, and a restart must not resume it (see macroRunner.ts);
// the "will be cleared" markers are scaffolding of the Prévia monitor, dropped at a
// restart like the preview instances (see loadInitialSlices.ts); the recordings are
// files on disk, and their list is rebuilt from the recordings folder at boot; where a
// run stopped short belongs to that run; and OBS's slice is what OBS says now, refilled
// from OBS at every connection (BAJAOVRLAY-27). The triggers' activity (BAJAOVRLAY-48):
// a firing that waited before a restart is not offered again after it. Its pause alone is
// saved, in a row of its own (gate 2 of PR #70; buildRowsOfChangedSlicesToSave).
const sliceNamesKeptInMemoryOnly: ReadonlyArray<keyof SlicesChangedByCommands> = [
  'previewClearedLayerIds',
  'macroRuns',
  'macroStops',
  'obs',
  'triggerActivity',
  'recordings',
];

/**
 * Names the slices a reducer changed, from the slices before and after. A reducer hands back
 * an unchanged slice as the very same array, so comparing the two arrays themselves is enough.
 * What could go wrong: a reducer that builds a new array with equal contents counts as
 * a change here, so it would be saved, logged and broadcast although nothing on screen
 * moves. Each reducer therefore compares by content where a command can repeat what is
 * already there (updateInstanceData, updateItemFields) and hands back the same slices.
 */
export function findNamesOfChangedSlices(
  slicesBefore: SlicesChangedByCommands,
  nextSlices: SlicesChangedByCommands,
): Array<keyof SlicesChangedByCommands> {
  return sliceNamesChangedByCommands.filter(
    (sliceName) => nextSlices[sliceName] !== slicesBefore[sliceName],
  );
}

/**
 * The slices-table rows of the changed slices, leaving out the slices kept in memory only
 * and the snapshots, which are saved one row per source (buildRowChangesOfDataSnapshots).
 * A change of the triggers' activity writes the pause's own row (triggerPauseRow.ts), so
 * a restart while paused comes back paused. It is written at every change of the activity,
 * a firing too: the pause before is not known here, and the row is a few bytes in a
 * transaction that writes the firing's event-log row anyway.
 */
export function buildRowsOfChangedSlicesToSave(
  nextSlices: SlicesChangedByCommands,
  changedSliceNames: Array<keyof SlicesChangedByCommands>,
  updatedAt: string,
): SliceRow[] {
  const changedSliceNamesToSave = changedSliceNames.filter((sliceName) => {
    const isKeptInMemoryOnly = sliceNamesKeptInMemoryOnly.includes(sliceName);
    const isSavedOneRowPerSource = sliceName === sliceNameSavedOneRowPerSource;
    return !isKeptInMemoryOnly && !isSavedOneRowPerSource;
  });
  const rowsToSave: SliceRow[] = changedSliceNamesToSave.map((sliceName) => ({
    name: sliceName,
    json: nextSlices[sliceName],
    updatedAt,
  }));
  if (changedSliceNames.includes('triggerActivity')) {
    rowsToSave.push(buildRowOfTheTriggerPause(nextSlices.triggerActivity, updatedAt));
  }
  return rowsToSave;
}

/**
 * Every slice: those a command may change, plus the event log. Written out one slice per
 * line on purpose: the compiler checks each name, and a new slice cannot be forgotten.
 */
export function buildAllSlices(
  slicesOfCommands: SlicesChangedByCommands,
  eventLog: Slices['eventLog'],
): Slices {
  return {
    outputs: slicesOfCommands.outputs,
    layers: slicesOfCommands.layers,
    graphics: slicesOfCommands.graphics,
    instances: slicesOfCommands.instances,
    previewClearedLayerIds: slicesOfCommands.previewClearedLayerIds,
    instanceBindings: slicesOfCommands.instanceBindings,
    programHistory: slicesOfCommands.programHistory,
    rundowns: slicesOfCommands.rundowns,
    items: slicesOfCommands.items,
    quickFirePanels: slicesOfCommands.quickFirePanels,
    macros: slicesOfCommands.macros,
    macroRuns: slicesOfCommands.macroRuns,
    macroStops: slicesOfCommands.macroStops,
    obs: slicesOfCommands.obs,
    triggers: slicesOfCommands.triggers,
    triggerActivity: slicesOfCommands.triggerActivity,
    dataSources: slicesOfCommands.dataSources,
    dataSnapshots: slicesOfCommands.dataSnapshots,
    overrides: slicesOfCommands.overrides,
    bracketMatchFocuses: slicesOfCommands.bracketMatchFocuses,
    recordings: slicesOfCommands.recordings,
    events: slicesOfCommands.events,
    eventRules: slicesOfCommands.eventRules,
    teams: slicesOfCommands.teams,
    people: slicesOfCommands.people,
    sponsors: slicesOfCommands.sponsors,
    scheduleSlots: slicesOfCommands.scheduleSlots,
    media: slicesOfCommands.media,
    eventLog,
  };
}
