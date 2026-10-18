// One line of a recording file, the one format the recorder writes and the boot listing
// and the replay read: `{"atMs":…,"snapshotNumber":…,"shapes":{…}}` followed by a
// newline, one per good poll. JSON Lines, so a file cut off by a power cut or a full
// disk loses at most its last line.
import type { DataSnapshotShapes } from '@bajaovrlay/shared';
import { z } from 'zod';

/**
 * A recorded line as the readers take it: its moment, its number, and its shapes as an
 * object of shape names, NOT checked against the shape schemas. The lines were checked
 * when they were written (the store accepted them), and checking 60 cars on each of
 * thousands of lines stalled the server (gate 2 on PR #16); the replay checks the one
 * line a poll answers instead. snapshotNumber is missing from lines written before
 * gate 2.
 */
const RecordedLineSchema = z.object({
  /** The moment the poll was made (the snapshot's receivedAtMs, server clock). */
  atMs: z.number().int(),
  /** 1 for the file's first line, 2 for the next: the last whole line gives the count. */
  snapshotNumber: z.number().int().positive().optional(),
  shapes: z.record(z.string(), z.unknown()),
});

/** A recorded line that has passed the light RecordedLineSchema (shapes unchecked). */
export type RecordedLine = z.infer<typeof RecordedLineSchema>;

/** What the recorder writes on one line. */
export type RecordingLineToWrite = {
  atMs: number;
  snapshotNumber: number;
  shapes: DataSnapshotShapes;
};

/** The text of one recorded line, newline included, ready to append to the file. */
export function buildRecordingLineText(line: RecordingLineToWrite): string {
  return `${JSON.stringify({
    atMs: line.atMs,
    snapshotNumber: line.snapshotNumber,
    shapes: line.shapes,
  })}\n`;
}

/**
 * Reads a recorded line lightly (its moment, number and an object of shapes), or
 * undefined when it is not one (cut off, hand-edited, no shapes, an empty line).
 */
export function parseRecordedLine(lineText: string): RecordedLine | undefined {
  const parsedLine = RecordedLineSchema.safeParse(parseJsonOrUndefined(lineText));
  return parsedLine.success ? parsedLine.data : undefined;
}

/** JSON.parse that answers undefined instead of throwing on text that is not JSON. */
function parseJsonOrUndefined(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
