import { z } from 'zod';

/**
 * Records a backup the server has just finished sending (GET /api/v1/backup,
 * BAJAOVRLAY-33). Sent only by the backup, `sistema:backup`, once the last byte of the zip
 * went out: a page that could send it would show "Última cópia" for a copy never made. It
 * changes no slice; its event-log row is the record, and "Última cópia" is read from it.
 */
export const RecordBackupCommandSchema = z.object({
  type: z.literal('recordBackup'),
  /** The zip's name, as the browser saved it: bajaovrlay-2026-11-14-1432.zip. */
  fileName: z.string().min(1),
  /** How many bytes the zip had, counted as they were sent. */
  sizeInBytes: z.number().int().nonnegative(),
  /** Whether the operator left "Incluir gravações" ticked. */
  includesRecordings: z.boolean(),
});

/** A recordBackup command after validation. */
export type RecordBackupCommand = z.infer<typeof RecordBackupCommandSchema>;
