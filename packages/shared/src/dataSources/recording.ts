import { z } from 'zod';

/**
 * One entry of the `recordings` slice: a recorded feed, one JSON line per good poll, in
 * `<DATA_DIR>/recordings/<sourceId>/<fileName>`. Metadata only; the server rebuilds the
 * list from the folder at boot and keeps it in memory.
 */
export const RecordingSchema = z.object({
  /** `<sourceId>/<fileName>`: unique, and the path of the file under the recordings folder. */
  id: z.string().min(1),
  sourceId: z.string().min(1),
  /** The source's label when the recording started; kept after the source is deleted. */
  sourceLabel: z.string().min(1),
  /**
   * The start moment in ISO 8601 with ':' made '-' (file systems refuse ':'), `.jsonl`;
   * a second recording of the same source in the same millisecond adds `-2`, `-3`, ...
   * after the moment, so two recordings never share a file.
   */
  fileName: z.string().min(1),
  startedAtMs: z.number().int(),
  /** When the recording stopped; null while it is still recording. */
  endedAtMs: z.number().int().nullable(),
  /** How many snapshots (lines) are in its file: counted once each line is written. */
  snapshotCount: z.number().int().min(0),
});

/** A recording that has passed RecordingSchema. */
export type Recording = z.infer<typeof RecordingSchema>;
