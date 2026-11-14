// The one part of the triggerActivity slice that is saved: "Pausar gatilhos" (gate 2 of
// PR #70). A server restarted during a podium must come back paused, or the next fastest
// lap would go on air by itself. The rest of the activity stays in memory only, as
// BAJAOVRLAY-48 chose: a firing that waited before a restart is not offered after it, and
// the minimum intervals start again.
import { type TriggerActivity, triggerActivityAtBoot } from '@bajaovrlay/shared';
import { z } from 'zod';

import type { SliceRow } from '../../core/db/tables.js';

/** The name of the slices-table row that holds the pause. Not a slice name on purpose. */
export const triggerPauseRowName = 'triggerPause';

// What the row holds. A row that fails it stops the boot, as every other saved row does:
// only a database edited by hand could hold one.
const SavedTriggerPauseSchema = z.object({ isPaused: z.boolean() });

/** The row that saves the pause of this activity, stamped `updatedAt`. */
export function buildRowOfTheTriggerPause(
  triggerActivity: TriggerActivity,
  updatedAt: string,
): SliceRow {
  return {
    name: triggerPauseRowName,
    json: { isPaused: triggerActivity.isPaused },
    updatedAt,
  };
}

/**
 * The activity a boot starts with: nothing fired, and paused when the saved row says so.
 * A database written before the pause was saved has no row and starts unpaused.
 */
export function readTriggerActivityAtBoot(storedRows: SliceRow[]): TriggerActivity {
  const storedRow = storedRows.find((row) => row.name === triggerPauseRowName);
  if (storedRow === undefined) {
    return triggerActivityAtBoot;
  }
  const savedPause = SavedTriggerPauseSchema.parse(storedRow.json);
  return { ...triggerActivityAtBoot, isPaused: savedPause.isPaused };
}
