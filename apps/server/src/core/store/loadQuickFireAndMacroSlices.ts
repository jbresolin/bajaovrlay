import { type Macro, type QuickFirePanel, SlicesSchema } from '@bajaovrlay/shared';

import type { SliceRow } from '../db/tables.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { seededQuickFirePanels } from './seedQuickFirePanels.js';

/** The quick-fire panels and macros a boot starts with, and the rows it must still save. */
export type QuickFireAndMacroSlicesAtBoot = {
  quickFirePanels: QuickFirePanel[];
  macros: Macro[];
  /** A row for each of the two slices that was missing and has just been seeded. */
  rowsToSaveAtBoot: SliceRow[];
};

/**
 * Reads the `quickFirePanels` and `macros` slices from the stored rows, seeding
 * whichever is missing: the panels with the single panel "Atalhos", the macros with an
 * empty list. The caller saves `rowsToSaveAtBoot` together with its other boot rows.
 * A missing row is normal (a first boot, or a database written before BAJAOVRLAY-16),
 * as for the rundowns; a row that is there but fails its schema throws, which stops the
 * boot. The `macroRuns` slice is not read here: it is never saved, and every boot
 * starts it empty.
 */
export function loadOrSeedQuickFireAndMacroSlices(
  storedRows: SliceRow[],
  updatedAt: string,
  logger: ServerLogger,
): QuickFireAndMacroSlicesAtBoot {
  const rowsToSaveAtBoot: SliceRow[] = [];

  const panelsRow = storedRows.find((row) => row.name === 'quickFirePanels');
  let quickFirePanels: QuickFirePanel[];
  if (panelsRow === undefined) {
    quickFirePanels = seededQuickFirePanels;
    rowsToSaveAtBoot.push({ name: 'quickFirePanels', json: quickFirePanels, updatedAt });
    logger.info('no stored quick-fire panels row; seeded the panel "Atalhos"');
  } else {
    quickFirePanels = SlicesSchema.shape.quickFirePanels.parse(panelsRow.json);
  }

  const macrosRow = storedRows.find((row) => row.name === 'macros');
  let macros: Macro[];
  if (macrosRow === undefined) {
    macros = [];
    rowsToSaveAtBoot.push({ name: 'macros', json: macros, updatedAt });
  } else {
    macros = SlicesSchema.shape.macros.parse(macrosRow.json);
  }

  return { quickFirePanels, macros, rowsToSaveAtBoot };
}
