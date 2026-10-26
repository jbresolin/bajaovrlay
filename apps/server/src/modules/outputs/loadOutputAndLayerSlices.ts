// Loading the outputs and layers at boot from the rows of the slices table, with the one
// migration BAJAOVRLAY-49 needs: a database written before outputs existed.
import {
  type Layer,
  type Output,
  type Outputs,
  programOutputId,
  SlicesSchema,
} from '@bajaovrlay/shared';

import type { SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import { ptBR } from '../../core/messages/ptBR.js';
import {
  addSeededLayersMissingFromStoredLayers,
  seededLayers,
} from '../../core/store/seedLayers.js';

/** The outputs and layers a boot starts with, and the rows the boot must still save. */
export type OutputAndLayerSlicesAtBoot = {
  outputs: Outputs;
  layers: Layer[];
  /** Both rows on a first boot or a migration, the layers row alone after a catch-up. */
  rowsToSaveAtBoot: SliceRow[];
};

/** The output every database has: OBS's main browser source, /render/. */
function buildProgramOutput(): Output {
  return { outputId: programOutputId, name: ptBR.outputs.programOutputName, order: 0 };
}

/**
 * Reads the `outputs` and `layers` slices from the stored rows, in one of three ways:
 * - a first boot (no row at all) seeds program and the seven layers on it;
 * - a database written before BAJAOVRLAY-49 (a layers row, no outputs row) gains
 *   program, every stored layer is assigned to it, and the seeded layers it lacks are
 *   added as they were before outputs (the tower, the notice); both rows are saved;
 * - a database with outputs is read as it is. The seed is no longer caught up: the
 *   layers are the operator's own now, and a seeded layer they deleted stays deleted.
 * A layers row missing from a database that has other rows stops the boot, as before:
 * booting with no layers would refuse every take, and re-seeding would hide the damage.
 * A row that fails its schema (two layers at one height of one output, no program)
 * throws, which stops the boot like every other stored slice.
 */
export function loadOrSeedOutputAndLayerSlices(
  storedRows: SliceRow[],
  updatedAt: string,
  logger: ServerLogger,
): OutputAndLayerSlicesAtBoot {
  const isFirstBoot = storedRows.length === 0;
  if (isFirstBoot) {
    const outputs = [buildProgramOutput()];
    return {
      outputs,
      layers: seededLayers,
      rowsToSaveAtBoot: [
        { name: 'outputs', json: outputs, updatedAt },
        { name: 'layers', json: seededLayers, updatedAt },
      ],
    };
  }

  const layersRow = storedRows.find((row) => row.name === 'layers');
  if (layersRow === undefined) {
    const message =
      'the slices table has rows but no layers row; the database is damaged, so the boot stops';
    logger.error({ stored_slices: storedRows.map((row) => row.name) }, message);
    throw new Error(message);
  }

  const outputsRow = storedRows.find((row) => row.name === 'outputs');
  if (outputsRow !== undefined) {
    return {
      outputs: SlicesSchema.shape.outputs.parse(outputsRow.json),
      layers: SlicesSchema.shape.layers.parse(layersRow.json),
      rowsToSaveAtBoot: [],
    };
  }
  return migrateLayersOfADatabaseBeforeOutputs(layersRow, updatedAt, logger);
}

/**
 * The boot of a database written before outputs: each stored layer gains
 * `outputId: 'program'`, the seeded layers it lacks are added in their z-order place,
 * and program is the one output. Only an object without an `outputId` is given one; the
 * rest is left for the schema to check, so a damaged row still stops the boot.
 */
function migrateLayersOfADatabaseBeforeOutputs(
  layersRow: SliceRow,
  updatedAt: string,
  logger: ServerLogger,
): OutputAndLayerSlicesAtBoot {
  const storedLayers: unknown[] = Array.isArray(layersRow.json) ? layersRow.json : [];
  const layersOnProgram = storedLayers.map((storedLayer) => {
    const isObjectWithoutAnOutput =
      typeof storedLayer === 'object' && storedLayer !== null && !('outputId' in storedLayer);
    return isObjectWithoutAnOutput ? { ...storedLayer, outputId: programOutputId } : storedLayer;
  });
  const layersRead = SlicesSchema.shape.layers.parse(layersOnProgram);
  const layersWithTheSeedCaughtUp = addSeededLayersMissingFromStoredLayers(layersRead);
  const outputs = [buildProgramOutput()];

  logger.info(
    { layers_assigned: layersRead.length },
    'stored layers assigned to the program output',
  );
  if (layersWithTheSeedCaughtUp.addedLayerIds.length > 0) {
    logger.info(
      { added_layer_ids: layersWithTheSeedCaughtUp.addedLayerIds },
      'seeded layers missing from the stored layers were added',
    );
  }
  return {
    outputs,
    layers: layersWithTheSeedCaughtUp.layers,
    rowsToSaveAtBoot: [
      { name: 'outputs', json: outputs, updatedAt },
      { name: 'layers', json: layersWithTheSeedCaughtUp.layers, updatedAt },
    ],
  };
}
