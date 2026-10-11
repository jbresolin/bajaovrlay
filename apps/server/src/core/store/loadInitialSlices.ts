import { type Slices, SlicesSchema } from '@bajaovrlay/shared';

import { readNewestEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeBootSliceRows } from '../db/sliceRowStorage.js';
import type { SliceRow } from '../db/tables.js';
import { convertEventLogRowToEntry } from '../events/eventLogRowConversion.js';
import { eventLogSliceSize } from '../events/eventLogSlice.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { discoverBuiltGraphics } from './discoverBuiltGraphics.js';
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
 * database (so a restart restores what was on air), or seeded when it is empty. The
 * graphics slice is rebuilt from the built packages on every boot and saved, because it
 * describes what is on disk, not what the operator did. The event-log slice is the
 * newest entries of the event_log table.
 */
export function loadInitialSlices(options: LoadInitialSlicesOptions): Slices {
  const storedRows = readAllSliceRows(options.database);
  const isFirstBoot = storedRows.length === 0;
  const operatorSlices = isFirstBoot
    ? buildSeedOperatorSlices()
    : readStoredOperatorSlices(storedRows, options.logger);
  const graphics = discoverBuiltGraphics(options.graphicPackagesFolder, options.logger);

  // The graphics row is rewritten on every boot; layers and instances only when seeded.
  const updatedAt = options.readCurrentTime().toISOString();
  const graphicsRow: SliceRow = { name: 'graphics', json: graphics, updatedAt };
  const seedRows: SliceRow[] = [
    { name: 'layers', json: operatorSlices.layers, updatedAt },
    graphicsRow,
    { name: 'instances', json: operatorSlices.instances, updatedAt },
  ];
  writeBootSliceRows(options.database, isFirstBoot ? seedRows : [graphicsRow]);
  if (isFirstBoot) {
    options.logger.info('empty database seeded with the fixed layers');
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
    instances: operatorSlices.instances,
    eventLog,
    // PLACEHOLDER (BAJAOVRLAY-13): always empty and never read from the database. The
    // server work of this task loads both from their stored rows and seeds the rundown
    // "Sessão principal" on the first boot.
    rundowns: [],
    items: [],
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
