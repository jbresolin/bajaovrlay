import { type Slices, SlicesSchema } from '@bajaovrlay/shared';

import { readNewestEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSeedSliceRows } from '../db/sliceRowStorage.js';
import type { SliceRow } from '../db/tables.js';
import { convertEventLogRowToEntry } from '../events/eventLogRowConversion.js';
import { eventLogSliceSize } from '../events/eventLogSlice.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { readRaceClockGraphic } from './readRaceClockGraphic.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';
import { seededLayers } from './seedLayers.js';

/** What loadInitialSlices needs: the open database and where the race clock manifest is. */
export type LoadInitialSlicesOptions = {
  database: ServerDatabase;
  logger: ServerLogger;
  /** Absolute path of packages/graphics/race-clock/dist/race-clock.ograf.json. */
  raceClockManifestPath: string;
};

/**
 * Returns the slices the store starts with: loaded from the database (instances too, so
 * a restart restores what was on air), or seeded and saved when it is empty. The
 * event-log slice is always the newest entries of the event_log table.
 */
export function loadInitialSlices(options: LoadInitialSlicesOptions): Slices {
  const storedRows = readAllSliceRows(options.database);
  const isFirstBoot = storedRows.length === 0;

  let slicesChangedByCommands: SlicesChangedByCommands;
  if (isFirstBoot) {
    slicesChangedByCommands = buildSeedSlices(options);
    writeSeedSliceRows(options.database, convertSlicesToRows(slicesChangedByCommands));
    options.logger.info(
      { graphics: slicesChangedByCommands.graphics.map((graphic) => graphic.id) },
      'empty database seeded with the fixed layers',
    );
  } else {
    slicesChangedByCommands = readStoredSlices(storedRows);
  }

  const eventLog = readNewestEventLogRows(options.database, eventLogSliceSize).map(
    convertEventLogRowToEntry,
  );
  return { ...slicesChangedByCommands, eventLog };
}

/** Builds the first-boot slices: the fixed layers, the race clock if built, nothing on air. */
function buildSeedSlices(options: LoadInitialSlicesOptions): SlicesChangedByCommands {
  const raceClockGraphic = readRaceClockGraphic(options.raceClockManifestPath, options.logger);
  const graphics = raceClockGraphic === undefined ? [] : [raceClockGraphic];
  return { layers: seededLayers, graphics, instances: [] };
}

/**
 * Turns stored rows back into slices, checking each against the shared schema. A row
 * that fails the check throws, which stops the boot: running on state we cannot read
 * could put the wrong thing on air. A slice with no row starts empty.
 */
function readStoredSlices(storedRows: SliceRow[]): SlicesChangedByCommands {
  const storedValueOf = (sliceName: string): unknown =>
    storedRows.find((row) => row.name === sliceName)?.json ?? [];
  return {
    layers: SlicesSchema.shape.layers.parse(storedValueOf('layers')),
    graphics: SlicesSchema.shape.graphics.parse(storedValueOf('graphics')),
    instances: SlicesSchema.shape.instances.parse(storedValueOf('instances')),
  };
}

/** Turns the seed slices into rows for the slices table, all stamped with the same time. */
function convertSlicesToRows(slices: SlicesChangedByCommands): SliceRow[] {
  const updatedAt = new Date().toISOString();
  return [
    { name: 'layers', json: slices.layers, updatedAt },
    { name: 'graphics', json: slices.graphics, updatedAt },
    { name: 'instances', json: slices.instances, updatedAt },
  ];
}
