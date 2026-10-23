import { type Slices, SlicesSchema } from '@bajaovrlay/shared';

import {
  loadOrSeedDataSourceSlices,
  readRecordingsFromFolder,
} from '../../modules/dataSources/index.js';
import { loadEntitySlices } from '../../modules/entities/index.js';
import { loadMediaSlice } from '../../modules/media/index.js';
import { writeBootRows } from '../db/bootRowStorage.js';
import { readAllDataSnapshotRows } from '../db/dataSnapshotRowStorage.js';
import { readNewestEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import type { SliceRow } from '../db/tables.js';
import { convertEventLogRowToEntry } from '../events/eventLogRowConversion.js';
import { eventLogSliceSize } from '../events/eventLogSlice.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { discoverBuiltGraphics } from './discoverBuiltGraphics.js';
import { loadOrSeedQuickFireAndMacroSlices } from './loadQuickFireAndMacroSlices.js';
import { loadOrSeedRundownSlices } from './loadRundownSlices.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';
import { addSeededLayersMissingFromStoredLayers, seededLayers } from './seedLayers.js';

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

/**
 * The layers and instances the operator built up (graphics come from the filesystem),
 * and the ids of the seeded layers a later boot had to add to the stored ones, so the
 * caller knows to write the layers row again; empty on a first boot.
 */
type OperatorSlices = Pick<SlicesChangedByCommands, 'layers' | 'instances'> & {
  seededLayerIdsAdded: string[];
};

/**
 * Returns the slices the store starts with. Layers and instances are loaded from the
 * database (so a restart restores what was on air), or seeded when it is empty; the
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
  const operatorSlices = isFirstBoot
    ? buildSeedOperatorSlices()
    : readStoredOperatorSlices(storedRows, options.logger);
  // The layers come first: a graphic's manifest names its default layer, and the name
  // only counts if that layer exists.
  const graphics = discoverBuiltGraphics({
    graphicPackagesFolder: options.graphicPackagesFolder,
    existingLayerIds: operatorSlices.layers.map((layer) => layer.id),
    logger: options.logger,
  });

  // What was on the preview output does not survive a restart: a preview is something
  // the operator was looking at, not state the show depends on, and a stale one would
  // sit one "Tomar" away from air with nobody remembering why. Program instances stay.
  const instancesKeptAcrossTheRestart = operatorSlices.instances.filter(
    (instance) => instance.target !== 'preview',
  );
  const numberOfPreviewInstancesDropped =
    operatorSlices.instances.length - instancesKeptAcrossTheRestart.length;

  // The graphics row is rewritten on every boot; layers when seeded and when a layer
  // seeded since the database was written was added just above (the tower); instances
  // when seeded and when a preview was dropped just above, so that the database holds
  // what memory holds from the first moment (nothing else writes that row before the
  // next command that changes an instance).
  const updatedAt = options.readCurrentTime().toISOString();
  const layersRow: SliceRow = { name: 'layers', json: operatorSlices.layers, updatedAt };
  const graphicsRow: SliceRow = { name: 'graphics', json: graphics, updatedAt };
  const instancesRow: SliceRow = {
    name: 'instances',
    json: instancesKeptAcrossTheRestart,
    updatedAt,
  };
  const seedRows: SliceRow[] = [layersRow, graphicsRow, instancesRow];
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
  const rowsOfALaterBoot =
    numberOfPreviewInstancesDropped > 0 ? [graphicsRow, instancesRow] : [graphicsRow];
  if (instanceBindingsAtBoot.wasAnyEntryDropped) {
    rowsOfALaterBoot.push(instanceBindingsRow);
  }
  const wasAnySeededLayerAdded = operatorSlices.seededLayerIdsAdded.length > 0;
  if (wasAnySeededLayerAdded) {
    rowsOfALaterBoot.push(layersRow);
  }
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
  const layerAndGraphicRows = isFirstBoot ? seedRows : rowsOfALaterBoot;
  writeBootRows(options.database, {
    sliceRowsToWrite: [
      ...layerAndGraphicRows,
      ...rundownSlices.rowsToSaveAtBoot,
      ...quickFireAndMacroSlices.rowsToSaveAtBoot,
      ...dataSourceSlices.rowsToSaveAtBoot,
    ],
    sliceRowNamesToDelete: dataSourceSlices.sliceRowNamesToDeleteAtBoot,
    dataSnapshotRowChanges: dataSourceSlices.dataSnapshotRowChangesAtBoot,
  });
  if (isFirstBoot) {
    options.logger.info('empty database seeded with the fixed layers');
  }
  if (wasAnySeededLayerAdded) {
    options.logger.info(
      { added_layer_ids: operatorSlices.seededLayerIdsAdded },
      'seeded layers missing from the stored layers were added',
    );
  }
  if (numberOfPreviewInstancesDropped > 0) {
    options.logger.info(
      { dropped_preview_instances: numberOfPreviewInstancesDropped },
      'preview instances dropped at boot',
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
    layers: operatorSlices.layers,
    graphics,
    instances: instancesKeptAcrossTheRestart,
    // The "will be cleared" markers are never stored, like the macro runs: every boot
    // starts with none, as it starts with no preview instance. A row of that name in the
    // database (only a bug could have written one) is not read and is left where it is.
    previewClearedLayerIds: [],
    instanceBindings: instanceBindingsAtBoot.instanceBindings,
    eventLog,
    rundowns: rundownSlices.rundowns,
    items: rundownSlices.items,
    quickFirePanels: quickFireAndMacroSlices.quickFirePanels,
    macros: quickFireAndMacroSlices.macros,
    macroRuns: [],
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

/** The first-boot layers and instances: the fixed layers, nothing on air. */
function buildSeedOperatorSlices(): OperatorSlices {
  return { layers: seededLayers, instances: [], seededLayerIdsAdded: [] };
}

/**
 * Turns stored rows back into layers and instances, checking each against the shared
 * schema. A row that fails the check throws, which stops the boot: running on state we
 * cannot read could put the wrong thing on air. A missing instances row starts empty.
 * A seeded layer the stored layers lack (one added to the seed since the database was
 * written, like the tower) is added in its z-order place, and named in the answer.
 */
function readStoredOperatorSlices(storedRows: SliceRow[], logger: ServerLogger): OperatorSlices {
  const layersRow = storedRows.find((row) => row.name === 'layers');
  if (layersRow === undefined) {
    // Booting on with no layers would refuse every take, and re-seeding would hide that
    // the database was damaged. Stop and say so instead.
    const message =
      'the slices table has rows but no layers row; the database is damaged, so the boot stops';
    logger.error({ stored_slices: storedRows.map((row) => row.name) }, message);
    throw new Error(message);
  }
  const instancesRow = storedRows.find((row) => row.name === 'instances');
  const storedLayers = SlicesSchema.shape.layers.parse(layersRow.json);
  const layersWithTheSeedCaughtUp = addSeededLayersMissingFromStoredLayers(storedLayers);
  return {
    layers: layersWithTheSeedCaughtUp.layers,
    instances: SlicesSchema.shape.instances.parse(instancesRow?.json ?? []),
    seededLayerIdsAdded: layersWithTheSeedCaughtUp.addedLayerIds,
  };
}
