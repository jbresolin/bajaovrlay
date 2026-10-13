import { type Slices, SlicesSchema } from '@bajaovrlay/shared';

import { readNewestEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeBootSliceRows } from '../db/sliceRowStorage.js';
import type { SliceRow } from '../db/tables.js';
import { convertEventLogRowToEntry } from '../events/eventLogRowConversion.js';
import { eventLogSliceSize } from '../events/eventLogSlice.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { discoverBuiltGraphics } from './discoverBuiltGraphics.js';
import { loadOrSeedRundownSlices } from './loadRundownSlices.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';
import { seededLayers } from './seedLayers.js';

/** What loadInitialSlices needs: the open database, the graphics folder and a clock. */
export type LoadInitialSlicesOptions = {
  database: ServerDatabase;
  logger: ServerLogger;
  /** Absolute path of packages/graphics; each built package there becomes a graphic. */
  graphicPackagesFolder: string;
  /** The clock that stamps the rows written at boot. */
  readCurrentTime: () => Date;
};

/** The layers and instances the operator built up; graphics come from the filesystem. */
type OperatorSlices = Pick<SlicesChangedByCommands, 'layers' | 'instances'>;

/**
 * Returns the slices the store starts with. Layers and instances are loaded from the
 * database (so a restart restores what was on air), or seeded when it is empty; the
 * instances of the preview output are the exception and are dropped at every boot. The
 * graphics slice is rebuilt from the built packages on every boot and saved, because it
 * describes what is on disk, not what the operator did. The event-log slice is the
 * newest entries of the event_log table. Rundowns and items are the operator's too:
 * loaded, or seeded when missing, by loadRundownSlices.ts.
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

  // The graphics row is rewritten on every boot; layers only when seeded; instances
  // when seeded and when a preview was dropped just above, so that the database holds
  // what memory holds from the first moment (nothing else writes that row before the
  // next command that changes an instance).
  const updatedAt = options.readCurrentTime().toISOString();
  const graphicsRow: SliceRow = { name: 'graphics', json: graphics, updatedAt };
  const instancesRow: SliceRow = {
    name: 'instances',
    json: instancesKeptAcrossTheRestart,
    updatedAt,
  };
  const seedRows: SliceRow[] = [
    { name: 'layers', json: operatorSlices.layers, updatedAt },
    graphicsRow,
    instancesRow,
  ];
  const rowsOfALaterBoot =
    numberOfPreviewInstancesDropped > 0 ? [graphicsRow, instancesRow] : [graphicsRow];
  // Rundowns and items are loaded, or seeded when their row is missing (a first boot,
  // or a database written before they existed); see loadRundownSlices.ts.
  const rundownSlices = loadOrSeedRundownSlices(storedRows, updatedAt, options.logger);
  const layerAndGraphicRows = isFirstBoot ? seedRows : rowsOfALaterBoot;
  writeBootSliceRows(options.database, [...layerAndGraphicRows, ...rundownSlices.seededRows]);
  if (isFirstBoot) {
    options.logger.info('empty database seeded with the fixed layers');
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
    eventLog,
    rundowns: rundownSlices.rundowns,
    items: rundownSlices.items,
  };
}

/** The first-boot layers and instances: the fixed layers, nothing on air. */
function buildSeedOperatorSlices(): OperatorSlices {
  return { layers: seededLayers, instances: [] };
}

/**
 * Turns stored rows back into layers and instances, checking each against the shared
 * schema. A row that fails the check throws, which stops the boot: running on state we
 * cannot read could put the wrong thing on air. A missing instances row starts empty.
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
  return {
    layers: SlicesSchema.shape.layers.parse(layersRow.json),
    instances: SlicesSchema.shape.instances.parse(instancesRow?.json ?? []),
  };
}
