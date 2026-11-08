// Everything about the backup download (BAJAOVRLAY-33) that @bajaovrlay/shared exports.
// The package's own index.ts re-exports this file with one line; other packages import
// from '@bajaovrlay/shared', never from here.

// The command the server sends when a backup finished (server only, `sistema:backup`).
export { type RecordBackupCommand, RecordBackupCommandSchema } from './backupCommands.js';
// One finished backup, the summary route's answer, the download's query and the expected size.
export {
  addUpExpectedBackupSize,
  type BackupDownloadQuery,
  BackupDownloadQuerySchema,
  type BackupMade,
  BackupMadeSchema,
  type BackupSummary,
  BackupSummarySchema,
} from './backupSummary.js';
// A size as the operator reads it: "48 MB".
export { formatBackupSize } from './backupSizeText.js';
// The backup an event-log row records, and the newest of the server's answer and the live slice.
export { chooseTheLatestBackup, readBackupOfEventLogEntry } from './latestBackup.js';
