import type { ServerDatabase } from './openDatabase.js';
import { writeSliceRows } from './sliceRowStorage.js';
import { eventLogRows, type NewEventLogRow, type SliceRow } from './tables.js';

/** What one command left behind: the slices it changed (maybe none) and its event-log row. */
export type CommandOutcomeToSave = {
  changedSliceRows: SliceRow[];
  eventLogRow: NewEventLogRow;
};

/**
 * Saves a command's changed slices and its event-log row in ONE SQLite transaction and
 * returns the new row's id. If any write fails, none is kept, so the saved slices and
 * the event log can never disagree, even after a crash half way through.
 */
export function saveCommandOutcome(
  database: ServerDatabase,
  outcome: CommandOutcomeToSave,
): number {
  const saveBothTogether = database.$client.transaction(() => {
    writeSliceRows(database, outcome.changedSliceRows);
    const insertedRow = database
      .insert(eventLogRows)
      .values(outcome.eventLogRow)
      .returning({ id: eventLogRows.id })
      .get();
    return insertedRow.id;
  });
  return saveBothTogether();
}
