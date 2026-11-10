import {
  obsSliceWithoutObs,
  type Slices,
  SlicesSchema,
  triggerActivityAtBoot,
} from '@bajaovrlay/shared';

import {
  loadOrSeedDataSourceSlices,
  readRecordingsFromFolder,
} from '../../modules/dataSources/index.js';
import { loadEntitySlices } from '../../modules/entities/index.js';
import {
  isInstanceOfAnEvent,
  loadOrSeedEventInboxSlices,
  markEventsOnAirAsShownAtBoot,
} from '../../modules/events/index.js';
import { loadMediaSlice } from '../../modules/media/index.js';
import { loadOrSeedOutputAndLayerSlices } from '../../modules/outputs/index.js';
import { writeBootRows } from '../db/bootRowStorage.js';
import { readAllDataSnapshotRows } from '../db/dataSnapshotRowStorage.js';
import { readNewestEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { readSeedNamesDone } from '../db/seedDoneRowStorage.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import type { SliceRow } from '../db/tables.js';
import { convertEventLogRowToEntry } from '../events/eventLogRowConversion.js';
import { eventLogSliceSize } from '../events/eventLogSlice.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { discoverBuiltGraphics } from './discoverBuiltGraphics.js';
import { loadOrSeedQuickFireAndMacroSlices } from './loadQuickFireAndMacroSlices.js';
import { loadOrSeedRundownSlices } from './loadRundownSlices.js';
import { forgetChangesThatCannotComeBack } from './programHistory/forgetChangesThatCannotComeBack.js';
import { bringStepsWithinTheirCount } from './reducers/instanceStepsWithinTheirCount.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';
import {
  addChannelLogoLayerAndItemOnce,
  channelLogoSeedName,
  type ChannelLogoSeedOutcome,
} from './seedChannelLogo.js';

/** What loadInitialSlices needs: the open database, the graphics folder and a clock. */
export type LoadInitialSlicesOptions = {
  database: ServerDatabase;
  logger: ServerLogger;
  /** Absolute path of packages/graphics; each built package there becomes a graphic. */
  graphicPackagesFolder: string;
  /** The clock that stamps the rows written at boot. */
  readCurrentTime: () => Date;
  /**
   * `<DATA_DIR>/recordings`: the `recordings` slice is rebuilt from it. The server always
   * passes it; a test that has nothing to do with recordings leaves it out and starts
   * with no recording.
   */
  recordingsFolder?: string | undefined;
};

/** The instances the operator built up (graphics come from the filesystem). */
type OperatorSlices = Pick<SlicesChangedByCommands, 'instances'>;

/**
 * Returns the slices the store starts with. Outputs and layers are loaded, seeded or
 * migrated by modules/outputs (loadOrSeedOutputAndLayerSlices). Instances are loaded
 * from the database (so a restart restores what was on air), empty on a first boot; the
 * instances of the preview output are the exception and are dropped at every boot. The
 * graphics slice is rebuilt from the built packages on every boot and saved, because it
 * describes what is on disk, not what the operator did. The event-log slice is the
 * newest entries of the event_log table. Rundowns and items are the operator's too:
 * loaded, or seeded when missing, by loadRundownSlices.ts; quick-fire panels and macros
 * likewise by loadQuickFireAndMacroSlices.ts. The macro runs and the "will be cleared"
 * markers are never stored: every boot starts with none, so a macro cut short by a stop
 * is not resumed and Prévia starts empty. Data sources and their snapshots are loaded,
 * or the simulator seeded, by modules/dataSources (loadOrSeedDataSourceSlices); the
 * recordings are listed from the recordings folder (readRecordingsFromFolder).
 */
export function loadInitialSlices(options: LoadInitialSlicesOptions): Slices {
  const storedRows = readAllSliceRows(options.database);
  const isFirstBoot = storedRows.length === 0;
  const updatedAt = options.readCurrentTime().toISOString();
  // The layers come first: a graphic's manifest names its default layer, and the name
  // only counts if that layer exists. Loading them also stops the boot of a database
  // that has rows but lost its layers row (modules/outputs).
  const outputAndLayerSlices = loadOrSeedOutputAndLayerSlices(
    storedRows,
    updatedAt,
    options.logger,
  );
  const operatorSlices = isFirstBoot ? { instances: [] } : readStoredOperatorSlices(storedRows);
  // Rundowns and items are loaded, or seeded when their row is missing (a first boot,
  // or a database written before they existed); see loadRundownSlices.ts.
  const rundownSlices = loadOrSeedRundownSlices(storedRows, updatedAt, options.logger);
  const quickFireAndMacroSlices = loadOrSeedQuickFireAndMacroSlices(
    storedRows,
    updatedAt,
    options.logger,
  );
  // Data sources and their snapshots are loaded, the simulator seeded when there is no
  // source, and every source that was on comes back stale (modules/dataSources). The
  // snapshots come one row per source from their own table; a legacy single row of them
  // is split there, once.
  const dataSourceSlices = loadOrSeedDataSourceSlices(
    storedRows,
    readAllDataSnapshotRows(options.database),
    updatedAt,
    options.logger,
  );
  // The event inbox's events and rules (BAJAOVRLAY-44): loaded, the rules seeded when
  // their row is missing; see modules/events/loadEventInboxSlices.ts.
  // Seeding the rules also seeds the "Avisos" panel and its two items, once per database,
  // so the panels and items go through it.
  // The one-off seeds this database has had (seeds_done): the inbox's and the logo's.
  const seedNamesDone = readSeedNamesDone(options.database);
  const eventInboxSlices = loadOrSeedEventInboxSlices(
    storedRows,
    { quickFirePanels: quickFireAndMacroSlices.quickFirePanels, items: rundownSlices.items },
    seedNamesDone,
    updatedAt,
    options.logger,
  );
  // The channel logo's layer, panel and item (BAJAOVRLAY-63), once per database (seeds_done).
  // Before the graphics are discovered: the logo bug's manifest names the layer, and a
  // graphic whose default layer is unknown falls back to fullscreen.
  const channelLogoSeed = addChannelLogoLayerAndItemOnce({
    seedNamesDone,
    layers: outputAndLayerSlices.layers,
    quickFirePanels: eventInboxSlices.quickFirePanels,
    items: eventInboxSlices.items,
  });
  logChannelLogoSeed(channelLogoSeed, options.logger);
  const layers = channelLogoSeed.layers;
  const items = channelLogoSeed.items;
  const graphics = discoverBuiltGraphics({
    graphicPackagesFolder: options.graphicPackagesFolder,
    existingLayerIds: layers.map((layer) => layer.id),
    logger: options.logger,
  });

  // What was on the preview output does not survive a restart: a preview is something
  // the operator was looking at, not state the show depends on, and a stale one would
  // sit one "Tomar" away from air with nobody remembering why. Program instances stay,
  // except an event's notice (BAJAOVRLAY-44, gate 2 of PR #22): its auto-out is lost at a
  // restart, so it would stay up for good; its event is marked shown below.
  const instancesKeptAcrossTheRestart = operatorSlices.instances.filter(
    (instance) => instance.target !== 'preview' && !isInstanceOfAnEvent(instance),
  );
  // A graphic rebuilt with fewer steps since the stop (or data counted again by a newer
  // step counter) would leave an instance past its count: "Passo 6 de 3" on Camadas. It is
  // put on its last step now, with a log line, and the row written again (BAJAOVRLAY-25).
  const instancesWithinTheirSteps = bringStepsWithinTheirCount(
    instancesKeptAcrossTheRestart,
    graphics,
  );
  const numberOfPreviewInstancesDropped = operatorSlices.instances.filter(
    (instance) => instance.target === 'preview',
  ).length;
  const numberOfInstancesDropped =
    operatorSlices.instances.length - instancesKeptAcrossTheRestart.length;

  // The graphics row is rewritten on every boot; instances when seeded and when a
  // preview was dropped just above, so that the database holds what memory holds from
  // the first moment (nothing else writes that row before the next command that changes
  // an instance). The outputs and layers rows are modules/outputs' to decide.
  const graphicsRow: SliceRow = { name: 'graphics', json: graphics, updatedAt };
  const instancesRow: SliceRow = {
    name: 'instances',
    json: instancesWithinTheirSteps.instances,
    updatedAt,
  };
  const seedRows: SliceRow[] = [graphicsRow, instancesRow];
  // The bindings of what is on air are saved with the instances (BAJAOVRLAY-20), so a
  // restart goes on refreshing them; a dropped preview's entry goes with it.
  const instanceBindingsAtBoot = readInstanceBindingsKeptAcrossTheRestart(
    storedRows,
    instancesKeptAcrossTheRestart,
  );
  const instanceBindingsRow: SliceRow = {
    name: 'instanceBindings',
    json: instanceBindingsAtBoot.instanceBindings,
    updatedAt,
  };
  const isAnyInstanceChangedAtBoot =
    numberOfInstancesDropped > 0 || instancesWithinTheirSteps.stepsBroughtBack.length > 0;
  const rowsOfALaterBoot = isAnyInstanceChangedAtBoot ? [graphicsRow, instancesRow] : [graphicsRow];
  if (instanceBindingsAtBoot.wasAnyEntryDropped) {
    rowsOfALaterBoot.push(instanceBindingsRow);
  }
  const eventsAtBoot = markEventsOnAirAsShownAtBoot(eventInboxSlices.events, updatedAt);
  if (eventsAtBoot.wereAnyMarked) {
    rowsOfALaterBoot.push({ name: 'events', json: eventsAtBoot.events, updatedAt });
  }
  const graphicAndInstanceRows = isFirstBoot ? seedRows : rowsOfALaterBoot;
  writeBootRows(options.database, {
    sliceRowsToWrite: [
      ...outputAndLayerSlices.rowsToSaveAtBoot,
      ...graphicAndInstanceRows,
      ...rundownSlices.rowsToSaveAtBoot,
      ...quickFireAndMacroSlices.rowsToSaveAtBoot,
      ...dataSourceSlices.rowsToSaveAtBoot,
      ...eventInboxSlices.rowsToSaveAtBoot,
      // Last, so these rows win over any earlier layers, panels or items row of this boot.
      ...listRowsOfTheChannelLogoSeed(channelLogoSeed, updatedAt),
    ],
    sliceRowNamesToDelete: dataSourceSlices.sliceRowNamesToDeleteAtBoot,
    dataSnapshotRowChanges: dataSourceSlices.dataSnapshotRowChangesAtBoot,
    seedNamesDone: [
      ...eventInboxSlices.seedNamesDoneAtBoot,
      ...(channelLogoSeed.isSeedApplied ? [channelLogoSeedName] : []),
    ],
    bootedAt: updatedAt,
  });
  if (isFirstBoot) {
    options.logger.info('empty database seeded with the program output and its layers');
  }
  if (numberOfPreviewInstancesDropped > 0) {
    options.logger.info(
      { dropped_preview_instances: numberOfPreviewInstancesDropped },
      'preview instances dropped at boot',
    );
  }
  for (const stepBroughtBack of instancesWithinTheirSteps.stepsBroughtBack) {
    options.logger.info(
      {
        instance_id: stepBroughtBack.instanceId,
        step_before: stepBroughtBack.stepBefore,
        step_after: stepBroughtBack.stepAfter,
      },
      'instance brought back at boot to the last step its graphic has',
    );
  }
  options.logger.info(
    { graphics: graphics.map((graphic) => graphic.id) },
    'graphics registered from the built packages',
  );

  const eventLog = readNewestEventLogRows(options.database, eventLogSliceSize).map(
    convertEventLogRowToEntry,
  );
  return {
    outputs: outputAndLayerSlices.outputs,
    layers,
    graphics,
    instances: instancesWithinTheirSteps.instances,
    // The "will be cleared" markers are never stored, like the macro runs: every boot
    // starts with none, as it starts with no preview instance. A row of that name in the
    // database (only a bug could have written one) is not read and is left where it is.
    previewClearedLayerIds: [],
    instanceBindings: instanceBindingsAtBoot.instanceBindings,
    // What each layer showed before its last changes (BAJAOVRLAY-30) is saved, so "Desfazer"
    // works across a restart. A database written before it has no row and starts with none;
    // a row that fails its schema stops the boot, as the overrides row does. A change naming
    // a graphic gone from the build since is forgotten, or undo would be refused on every
    // press (gate 2 of PR #44). Only in memory: each boot forgets it again, and the next
    // change of program writes the row without it.
    programHistory: forgetChangesThatCannotComeBack(
      SlicesSchema.shape.programHistory.parse(
        storedRows.find((row) => row.name === 'programHistory')?.json ?? [],
      ),
      items,
      graphics,
    ),
    eventLog,
    rundowns: rundownSlices.rundowns,
    items,
    quickFirePanels: channelLogoSeed.quickFirePanels,
    macros: quickFireAndMacroSlices.macros,
    macroRuns: [],
    // Memory only too (BAJAOVRLAY-27): where a run stopped short means nothing after a
    // restart, and OBS's slice is refilled by the OBS connection as soon as it connects.
    macroStops: [],
    obs: obsSliceWithoutObs,
    // The triggers are saved (BAJAOVRLAY-48); a database written before them has no row
    // and starts with none, and a row that fails its schema stops the boot, as the items
    // row does. Their activity is memory only: every boot starts unpaused, nothing fired.
    triggers: SlicesSchema.shape.triggers.parse(
      storedRows.find((row) => row.name === 'triggers')?.json ?? [],
    ),
    triggerActivity: triggerActivityAtBoot,
    dataSources: dataSourceSlices.dataSources,
    dataSnapshots: dataSourceSlices.dataSnapshots,
    // The operator's corrections are saved (BAJAOVRLAY-20): a restart keeps every one in
    // force. A database written before them has no row and starts with none; a row that
    // fails its schema stops the boot, as the items row does.
    overrides: SlicesSchema.shape.overrides.parse(
      storedRows.find((row) => row.name === 'overrides')?.json ?? [],
    ),
    // Rebuilt from the recordings folder at every boot, every recording closed (D13);
    // never saved in the database: the files are the truth.
    recordings: readRecordingsAtBoot(options, dataSourceSlices.dataSources),
    events: eventsAtBoot.events,
    eventRules: eventInboxSlices.eventRules,
    // The entity library (BAJAOVRLAY-19), loaded by modules/entities; nothing is seeded.
    ...loadEntitySlices(storedRows),
    // Its images, loaded by modules/media; the files themselves are under DATA_DIR/media.
    media: loadMediaSlice(storedRows),
  };
}

/** The recordings in the recordings folder, or none when no folder was given (tests). */
function readRecordingsAtBoot(
  options: LoadInitialSlicesOptions,
  dataSources: Slices['dataSources'],
): Slices['recordings'] {
  if (options.recordingsFolder === undefined) {
    return [];
  }
  return readRecordingsFromFolder(options.recordingsFolder, dataSources, options.logger);
}

/**
 * The stored instanceBindings, keeping only the entries of instances still there after
 * the boot (a preview's go with the preview). A database written before BAJAOVRLAY-20
 * has no row and starts with none; a row that fails its schema stops the boot, as the
 * instances row does, because refreshing on bindings we cannot read could change what
 * is on air.
 */
function readInstanceBindingsKeptAcrossTheRestart(
  storedRows: SliceRow[],
  instancesKept: Slices['instances'],
): { instanceBindings: Slices['instanceBindings']; wasAnyEntryDropped: boolean } {
  const storedRow = storedRows.find((row) => row.name === 'instanceBindings');
  const storedEntries = SlicesSchema.shape.instanceBindings.parse(storedRow?.json ?? []);
  const instanceIdsKept = new Set(instancesKept.map((instance) => instance.id));
  const entriesKept = storedEntries.filter((entry) => instanceIdsKept.has(entry.instanceId));
  return {
    instanceBindings: entriesKept,
    wasAnyEntryDropped: entriesKept.length !== storedEntries.length,
  };
}

/**
 * Turns the stored instances row back into instances, checking it against the shared
 * schema. A row that fails the check throws, which stops the boot: running on state we
 * cannot read could put the wrong thing on air. A missing instances row starts empty.
 */
function readStoredOperatorSlices(storedRows: SliceRow[]): OperatorSlices {
  const instancesRow = storedRows.find((row) => row.name === 'instances');
  return { instances: SlicesSchema.shape.instances.parse(instancesRow?.json ?? []) };
}

/**
 * The layers and items rows the channel logo's seed must write: both when it was applied
 * (one of them may be unchanged, which costs one row), none otherwise.
 */
function listRowsOfTheChannelLogoSeed(
  channelLogoSeed: ChannelLogoSeedOutcome,
  updatedAt: string,
): SliceRow[] {
  if (!channelLogoSeed.isSeedApplied) {
    return [];
  }
  return [
    { name: 'layers', json: channelLogoSeed.layers, updatedAt },
    { name: 'quickFirePanels', json: channelLogoSeed.quickFirePanels, updatedAt },
    { name: 'items', json: channelLogoSeed.items, updatedAt },
  ];
}

/** Says in the log what the channel logo's seed did, when it ran at this boot. */
function logChannelLogoSeed(channelLogoSeed: ChannelLogoSeedOutcome, logger: ServerLogger): void {
  if (!channelLogoSeed.isSeedApplied) {
    return;
  }
  if (channelLogoSeed.zIndexTakenByTheOperator !== undefined) {
    logger.warn(
      { z_index: channelLogoSeed.zIndexTakenByTheOperator },
      'the "Logo do canal" layer and item were not seeded: a layer of the operator holds their height',
    );
    return;
  }
  logger.info('seeded the "Logo do canal" layer and item');
}
