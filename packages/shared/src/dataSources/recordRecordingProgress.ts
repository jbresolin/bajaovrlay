// The command the server's recorder sends once lines of a recording are in its file, so
// the `recordings` slice counts only snapshots the disk really holds (gate 2 on PR #16).
// Only the recorder may send it (actor `sistema:gravador`); a control page never does.
import { z } from 'zod';

/**
 * How many lines of a recording are now in its file. A whole count, not "one more", so a
 * report that arrives twice or late still leaves the right number.
 */
export const RecordRecordingProgressCommandSchema = z.object({
  type: z.literal('recordRecordingProgress'),
  recordingId: z.string().min(1),
  snapshotCount: z.number().int().nonnegative(),
});

/** A recordRecordingProgress command after validation. */
export type RecordRecordingProgressCommand = z.infer<typeof RecordRecordingProgressCommandSchema>;
