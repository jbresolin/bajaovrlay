// Loading the media slice at boot from its row of the slices table.
import { type Slices, SlicesSchema } from '@bajaovrlay/shared';

import type { SliceRow } from '../../core/db/tables.js';

/**
 * Reads the media slice from its stored row. A database written before BAJAOVRLAY-19 has
 * no row and starts with no image. A row that fails its schema stops the boot, as the
 * entity rows do: the library would otherwise point at images nobody can read.
 */
export function loadMediaSlice(storedRows: SliceRow[]): Slices['media'] {
  const storedRow = storedRows.find((row) => row.name === 'media');
  return SlicesSchema.shape.media.parse(storedRow?.json ?? []);
}
