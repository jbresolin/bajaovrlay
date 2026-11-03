// Turning a recording, handed over a chunk of text at a time, into its recorded lines,
// one line as soon as its chunk arrives. This is what keeps loading a large recording
// from stalling the server: each chunk is parsed and handed over before the next one is
// asked for, so the event loop turns between chunks (gate 2 on PR #16). Reading the
// whole file first and parsing it afterwards would hold the loop for the whole file;
// recordedLinesFromChunks.test.ts fails at once on such a read (BAJAOVRLAY-52).
import { parseRecordedLine, type RecordedLine } from '../../recordingLine.js';

/**
 * Hands over the recorded lines of a text that arrives in chunks (a file read stream
 * with an encoding), each line as soon as the chunk ending it arrives. A line cut between
 * two chunks is put back together; a last line with no newline after it still counts.
 * Lines that are not recorded lines (blank, damaged) are skipped, as the replay skips them.
 */
export async function* readRecordedLinesOneChunkAtATime(
  chunks: AsyncIterable<string>,
): AsyncGenerator<RecordedLine> {
  // The start of a line whose end has not arrived yet.
  let unfinishedLineText = '';
  for await (const chunk of chunks) {
    const pieces = (unfinishedLineText + chunk).split('\n');
    // The last piece has no newline after it (yet): it waits for the next chunk.
    unfinishedLineText = pieces.pop() ?? '';
    for (const lineText of pieces) {
      const line = parseLineText(lineText);
      if (line !== undefined) {
        yield line;
      }
    }
  }
  const lastLine = parseLineText(unfinishedLineText);
  if (lastLine !== undefined) {
    yield lastLine;
  }
}

/**
 * One line's text as a recorded line, or undefined when it is not one. A file edited on
 * Windows ends its lines with "\r\n": the "\r" is dropped, as the readline the reader once
 * used dropped it.
 */
function parseLineText(lineText: string): RecordedLine | undefined {
  const lineTextWithoutCarriageReturn = lineText.endsWith('\r') ? lineText.slice(0, -1) : lineText;
  return parseRecordedLine(lineTextWithoutCarriageReturn);
}
