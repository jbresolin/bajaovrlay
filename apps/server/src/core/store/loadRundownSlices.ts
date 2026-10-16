import { type Item, type Rundown, SlicesSchema } from '@bajaovrlay/shared';

import type { SliceRow } from '../db/tables.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { convertStoredItemsToTheirHome } from './itemHomeMigration.js';
import { seededRundowns } from './seedRundowns.js';

/** The rundowns and items a boot starts with, and the rows the boot must still save. */
export type RundownSlicesAtBoot = {
  rundowns: Rundown[];
  items: Item[];
  /**
   * A row for each of the two slices that was missing and has just been seeded, and the
   * items row when stored items were converted to their home.
   */
  rowsToSaveAtBoot: SliceRow[];
};

/**
 * Reads the `rundowns` and `items` slices from the stored rows, seeding whichever is
 * missing: `rundowns` with the single rundown "Sessão principal", `items` with an
 * empty list. The caller saves `rowsToSaveAtBoot` together with its other boot rows.
 *
 * A missing row is normal here, unlike a missing layers row (which stops the boot): a
 * database written before rundowns existed (M0) has layers, graphics and instances and
 * nothing else, and it must boot. Seeding cannot hide damage the way re-seeding layers
 * would, because nothing on air depends on a rundown.
 * What could go wrong: if the rundowns row alone is lost from a newer database, the
 * operator's rundown names and cursors are replaced by the seed without the boot
 * stopping; the items are kept and, having the seeded rundown's id, show up in it.
 *
 * A row that is there but fails its schema still throws, which stops the boot, like
 * every other stored slice. Stored items written before BAJAOVRLAY-16 are first
 * converted to their `home` (itemHomeMigration.ts); when any was, the converted row is
 * saved with the other boot rows, so the database holds what memory holds from the
 * first moment and the conversion runs once.
 */
export function loadOrSeedRundownSlices(
  storedRows: SliceRow[],
  updatedAt: string,
  logger: ServerLogger,
): RundownSlicesAtBoot {
  const rowsToSaveAtBoot: SliceRow[] = [];

  const rundownsRow = storedRows.find((row) => row.name === 'rundowns');
  let rundowns: Rundown[];
  if (rundownsRow === undefined) {
    rundowns = seededRundowns;
    rowsToSaveAtBoot.push({ name: 'rundowns', json: rundowns, updatedAt });
    logger.info('no stored rundowns row; seeded the main session rundown');
  } else {
    rundowns = SlicesSchema.shape.rundowns.parse(rundownsRow.json);
  }

  const itemsRow = storedRows.find((row) => row.name === 'items');
  let items: Item[];
  if (itemsRow === undefined) {
    items = [];
    rowsToSaveAtBoot.push({ name: 'items', json: items, updatedAt });
  } else {
    const conversion = convertStoredItemsToTheirHome(itemsRow.json);
    items = SlicesSchema.shape.items.parse(conversion.storedItems);
    if (conversion.numberOfItemsConverted > 0) {
      rowsToSaveAtBoot.push({ name: 'items', json: items, updatedAt });
      logger.info(
        { converted_items: conversion.numberOfItemsConverted },
        'stored items converted to their home',
      );
    }
  }

  return { rundowns, items, rowsToSaveAtBoot };
}
