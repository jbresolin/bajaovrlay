// One line of a recording file, the one format the recorder writes and the boot listing
// and the replay read: `{"atMs":…,"shapes":{…}}` followed by a newline, one per good
// poll. JSON Lines, so a file cut off by a power cut loses at most its last line.
import { type DataSnapshotShapes, DataSnapshotShapesSchema } from '@bajaovrlay/shared';
import { z } from 'zod';

/**
 * A recorded line: the moment the poll was made (the snapshot's receivedAtMs, server
 * clock) and the shapes the store accepted, already valid when they were written.
 */
export const RecordingLineSchema = z.object({
  atMs: z.number().int(),
  shapes: DataSnapshotShapesSchema,
});

/** A recorded line that has passed RecordingLineSchema. */
export type RecordingLine = z.infer<typeof RecordingLineSchema>;

/**
 * Only the moment of a recorded line. The boot listing checks lines with this lighter
 * schema: it needs the moments and the count, and checking 60 cars on every line of
 * every recording would slow each boot down. The replay checks the whole line.
 */
const RecordingLineMomentSchema = z.object({ atMs: z.number().int() });

/** The text of one recorded line, newline included, ready to append to the file. */
export function buildRecordingLineText(atMs: number, shapes: DataSnapshotShapes): string {
  return `${JSON.stringify({ atMs, shapes })}\n`;
}

/** Splits a recording file's text into its lines, leaving out empty ones (the last newline). */
export function splitRecordingTextIntoLines(fileText: string): string[] {
  return fileText.split('\n').filter((lineText) => lineText.trim() !== '');
}

/** Reads a whole recorded line, or undefined when it is not one (cut off, hand-edited). */
export function parseRecordingLine(lineText: string): RecordingLine | undefined {
  const parsedLine = RecordingLineSchema.safeParse(parseJsonOrUndefined(lineText));
  return parsedLine.success ? parsedLine.data : undefined;
}

/** Reads only the moment of a recorded line, or undefined when it has none. */
export function parseRecordingLineMoment(lineText: string): number | undefined {
  const parsedLine = RecordingLineMomentSchema.safeParse(parseJsonOrUndefined(lineText));
  return parsedLine.success ? parsedLine.data.atMs : undefined;
}

/** JSON.parse that answers undefined instead of throwing on text that is not JSON. */
function parseJsonOrUndefined(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
