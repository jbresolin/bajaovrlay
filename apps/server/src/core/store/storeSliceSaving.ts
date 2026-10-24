// Which slices the store saves, and how: the slices a command may change, the one saved
// row by row in its own table, the ones kept in memory only, and how the rows to save
// and the whole state are built from them. Split from createStateStore.ts, whose job is
// the single command path.
import type { Slices } from '@bajaovrlay/shared';

import type { SliceRow } from '../db/tables.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';

/** The slices a reducer may change, in the order changes are reported. */
export const sliceNamesChangedByCommands = [
  'layers',
  'graphics',
  'instances',
  'previewClearedLayerIds',
  'instanceBindings',
  'rundowns',
  'items',
  'quickFirePanels',
  'macros',
  'macroRuns',
  'dataSources',
  'dataSnapshots',
  'overrides',
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
// files on disk, and their list is rebuilt from the recordings folder at boot.
const sliceNamesKeptInMemoryOnly: ReadonlyArray<keyof SlicesChangedByCommands> = [
  'previewClearedLayerIds',
  'macroRuns',
  'recordings',
];

/**
 * The slices-table rows of the changed slices, leaving out the slices kept in memory only
 * and the snapshots, which are saved one row per source (buildRowChangesOfDataSnapshots).
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
  return changedSliceNamesToSave.map((sliceName) => ({
    name: sliceName,
    json: nextSlices[sliceName],
    updatedAt,
  }));
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
    layers: slicesOfCommands.layers,
    graphics: slicesOfCommands.graphics,
    instances: slicesOfCommands.instances,
    previewClearedLayerIds: slicesOfCommands.previewClearedLayerIds,
    instanceBindings: slicesOfCommands.instanceBindings,
    rundowns: slicesOfCommands.rundowns,
    items: slicesOfCommands.items,
    quickFirePanels: slicesOfCommands.quickFirePanels,
    macros: slicesOfCommands.macros,
    macroRuns: slicesOfCommands.macroRuns,
    dataSources: slicesOfCommands.dataSources,
    dataSnapshots: slicesOfCommands.dataSnapshots,
    overrides: slicesOfCommands.overrides,
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
