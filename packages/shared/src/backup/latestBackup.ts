import type { EventLogEntry } from '../slices/eventLogEntry.js';
import { RecordBackupCommandSchema } from './backupCommands.js';
import type { BackupMade } from './backupSummary.js';

/**
 * The backup an event-log row records: its moment and size, or undefined for any row
 * that is not an accepted recordBackup (or whose payload cannot be read).
 */
export function readBackupOfEventLogEntry(entry: EventLogEntry): BackupMade | undefined {
  const isAcceptedBackupRow = entry.command === 'recordBackup' && entry.result.status === 'ok';
  if (!isAcceptedBackupRow) {
    return undefined;
  }
  const payload = RecordBackupCommandSchema.safeParse(entry.payload);
  if (!payload.success) {
    return undefined;
  }
  return { madeAt: entry.ts, sizeInBytes: payload.data.sizeInBytes };
}

/**
 * The newest of the backup the server answered (read from the database when the dialog
 * opened) and the backups in the live eventLog slice, which may hold one made since.
 * Undefined when there is none.
 */
export function chooseTheLatestBackup(
  backupTheServerAnswered: BackupMade | undefined,
  liveEventLog: readonly EventLogEntry[],
): BackupMade | undefined {
  let latestBackup = backupTheServerAnswered;
  for (const entry of liveEventLog) {
    const backupOfTheRow = readBackupOfEventLogEntry(entry);
    if (backupOfTheRow === undefined) {
      continue;
    }
    // ISO 8601 moments in UTC compare correctly as text.
    const isNewer = latestBackup === undefined || backupOfTheRow.madeAt > latestBackup.madeAt;
    if (isNewer) {
      latestBackup = backupOfTheRow;
    }
  }
  return latestBackup;
}
