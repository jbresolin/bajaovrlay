import {
  type DataSnapshotRowChanges,
  writeDataSnapshotRowChanges,
} from './dataSnapshotRowStorage.js';
import type { ServerDatabase } from './openDatabase.js';
import { writeSliceRows } from './sliceRowStorage.js';
import { eventLogRows, type NewEventLogRow, type SliceRow } from './tables.js';

/**
 * What one command left behind: the slices it changed (maybe none), the snapshot rows it
 * wrote or deleted (maybe none), and its event-log row.
 */
export type CommandOutcomeToSave = {
  changedSliceRows: SliceRow[];
  dataSnapshotRowChanges: DataSnapshotRowChanges;
  eventLogRow: NewEventLogRow;
};

/**
 * Saves a command's changed slices, its snapshot rows and its event-log row in ONE SQLite
 * transaction and returns the new row's id. If any write fails, none is kept, so the
 * saved slices and the event log can never disagree, even after a crash half way through.
 */
export function saveCommandOutcome(
  database: ServerDatabase,
  outcome: CommandOutcomeToSave,
): number {
  const saveEverythingTogether = database.$client.transaction(() => {
    writeSliceRows(database, outcome.changedSliceRows);
    writeDataSnapshotRowChanges(database, outcome.dataSnapshotRowChanges);
    const insertedRow = database
      .insert(eventLogRows)
      .values(outcome.eventLogRow)
      .returning({ id: eventLogRows.id })
      .get();
    return insertedRow.id;
  });
  return saveEverythingTogether();
}

/**
 * Saves the slices and snapshot rows one command changed, in one transaction, with no
 * event-log row: the one exception to "every command is logged", for a routine
 * data-source poll (decision D11; see createStateStore.ts).
 */
export function saveCommandOutcomeWithoutEventLogRow(
  database: ServerDatabase,
  outcome: Omit<CommandOutcomeToSave, 'eventLogRow'>,
): void {
  const saveBothTogether = database.$client.transaction(() => {
    writeSliceRows(database, outcome.changedSliceRows);
    writeDataSnapshotRowChanges(database, outcome.dataSnapshotRowChanges);
  });
  saveBothTogether();
}
