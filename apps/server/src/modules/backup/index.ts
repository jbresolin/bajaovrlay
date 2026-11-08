// Public surface of the backup module (BAJAOVRLAY-33). Core and the API routes import from
// here, never from the files inside.

// recordBackup's reducer: no slice changes, the row is logged all the same; reduceCommand calls it.
export { reduceRecordBackup } from './reducers/recordBackup.js';
// The backup downloads of one server: start one (one at a time), and the dialog's summary.
export {
  type BackupDownloads,
  type BackupDownloadsOptions,
  type BackupDownloadStart,
  createBackupDownloads,
} from './backupDownloads.js';
// The two routes (GET /api/v1/backup, GET /api/v1/backup/summary), their answers and headers.
export {
  buildBackupAlreadyRunningAnswer,
  buildBackupZipHeaders,
  buildDatabaseStayedLockedAnswer,
  buildInvalidBackupQueryAnswer,
  getBackupRoute,
  getBackupSummaryRoute,
} from './api.js';
