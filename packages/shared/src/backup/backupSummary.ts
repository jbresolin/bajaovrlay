import { z } from 'zod';

/** The moment and size of one finished backup, read from its event-log row. */
export const BackupMadeSchema = z.object({
  /** When the server finished sending it, as an ISO 8601 timestamp. */
  madeAt: z.iso.datetime(),
  sizeInBytes: z.number().int().nonnegative(),
});

/** One finished backup, after validation. */
export type BackupMade = z.infer<typeof BackupMadeSchema>;

/**
 * What GET /api/v1/backup/summary answers, for "Cópia de segurança": the size of each
 * part on disk now, so the dialog can add up the expected size with or without the
 * recordings, the newest backup in the event log (none when none was ever made), and
 * whether a backup is being sent now: a second would be refused, and the browser would
 * only say the download failed, so the dialog says why instead of offering "Baixar".
 */
export const BackupSummarySchema = z.object({
  databaseSizeInBytes: z.number().int().nonnegative(),
  mediaSizeInBytes: z.number().int().nonnegative(),
  recordingsSizeInBytes: z.number().int().nonnegative(),
  latestBackup: BackupMadeSchema.nullable(),
  isABackupRunning: z.boolean(),
});

/** The answer of GET /api/v1/backup/summary, after validation. */
export type BackupSummary = z.infer<typeof BackupSummarySchema>;

/**
 * The query of GET /api/v1/backup. `includeRecordings` is "false" when the operator
 * unticks "Incluir gravações"; left out, they are included. Any other value is refused,
 * so a typo never silently decides it.
 */
export const BackupDownloadQuerySchema = z.object({
  includeRecordings: z.enum(['true', 'false']).optional(),
});

/** The query of GET /api/v1/backup, after validation. */
export type BackupDownloadQuery = z.infer<typeof BackupDownloadQuerySchema>;

/**
 * The expected size of the zip: the database plus the media, plus the recordings when
 * ticked. The zip is stored, not compressed, so this is within a few kilobytes of it.
 */
export function addUpExpectedBackupSize(
  summary: BackupSummary,
  isIncludingRecordings: boolean,
): number {
  const sizeWithoutRecordings = summary.databaseSizeInBytes + summary.mediaSizeInBytes;
  if (!isIncludingRecordings) {
    return sizeWithoutRecordings;
  }
  return sizeWithoutRecordings + summary.recordingsSizeInBytes;
}
