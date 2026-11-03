/**
 * Recorded lines from a recording handed over in chunks (apps/server)
 *
 * What this module is for:
 *   The replay reads a recording file as a stream, a chunk of text at a time. Each chunk's
 *   lines are parsed and handed over before the next chunk is asked for, so the server's
 *   event loop turns between chunks and a large recording loads without stalling the
 *   server (gate 2 on PR #16).
 *
 * What these tests prove (a stream the test hands out by hand, no file and no clock):
 *   - The first line is handed over as soon as the chunk ending it arrives, while the
 *     stream is still open, and the next chunk is asked for only after it. A reader that
 *     read the whole recording before parsing it would ask for more chunks first, and
 *     fail this test at once: this is the CI guard that the replay streams
 *     (BAJAOVRLAY-52).
 *   - A line cut between two chunks is put back together, and a last line with no
 *     newline after it still counts.
 *   - Blank and damaged lines are skipped, and a line ending in "\r\n" is read whole.
 *
 * What these tests deliberately do not cover:
 *   - Reading a real file and its failures (missing, unreadable); replayAdapterLoading,
 *     replayAdapterFailedRead and replayAdapter.test.ts read real files.
 *   - How fast a large recording loads: replayLoading.benchmark.ts measures it by hand.
 */
import { describe, expect, it } from 'vitest';

import { buildRecordingLineText, type RecordedLine } from '../../recordingLine.js';
import { createChunksHandedOutByHand } from './chunksHandedOutByHand.testSupport.js';
import { buildFridayLineAt, fridayAt1300Ms } from './fridayTraining.testSupport.js';
import { readRecordedLinesOneChunkAtATime } from './recordedLinesFromChunks.js';
import { letPendingPromisesSettle } from './replayAdapter.testSupport.js';

/** The text of Friday's recorded line at a moment, newline included, as the recorder wrote it. */
function buildFridayLineTextAt(atMs: number, snapshotNumber: number): string {
  return buildRecordingLineText({ ...buildFridayLineAt(atMs), snapshotNumber });
}

/** Reads every line the reader hands over, until the stream ends. */
async function readEveryLine(lines: AsyncGenerator<RecordedLine>): Promise<RecordedLine[]> {
  const linesRead: RecordedLine[] = [];
  for await (const line of lines) {
    linesRead.push(line);
  }
  return linesRead;
}

describe('readRecordedLinesOneChunkAtATime', () => {
  it('hands over the first line before the stream ends, and asks for the next chunk only after it', async () => {
    // Arrange: Friday's lines at 13:00:00 and 13:00:02, and a first chunk holding the whole
    // first line and half of the second, as a file stream cuts them.
    const chunks = createChunksHandedOutByHand();
    const lines = readRecordedLinesOneChunkAtATime(chunks.chunks);
    const secondLineText = buildFridayLineTextAt(fridayAt1300Ms + 2_000, 2);
    const firstChunk =
      buildFridayLineTextAt(fridayAt1300Ms, 1) + secondLineText.slice(0, secondLineText.length / 2);
    let firstLineRead: RecordedLine | undefined;
    const readingTheFirstLine = lines.next().then((result) => {
      firstLineRead = result.done === true ? undefined : result.value;
    });
    await letPendingPromisesSettle();

    // Act: hand out the first chunk only, and let the reader do all it can with it.
    chunks.handOutTheNextChunk(firstChunk);
    await letPendingPromisesSettle();

    // Assert: the 13:00:00 line is already handed over, and the reader has not asked for
    // a second chunk: it parses as it reads, instead of reading everything first.
    expect(
      firstLineRead?.atMs,
      'the first line must be handed over while the stream is still open',
    ).toBe(fridayAt1300Ms);
    expect(
      chunks.countTheChunksAskedFor(),
      'the reader must hand the first line over before asking for the next chunk',
    ).toBe(1);
    await readingTheFirstLine;
  });

  it('puts a line cut between two chunks back together, and keeps a last line with no newline', async () => {
    // Arrange: Friday's lines at 13:00:00, 13:00:02 and 13:00:04, cut in two chunks in the
    // middle of the second line, the last line written without its newline (a file
    // copied by hand, or the recorder stopped before the newline).
    const chunks = createChunksHandedOutByHand();
    const lines = readRecordedLinesOneChunkAtATime(chunks.chunks);
    const wholeText =
      buildFridayLineTextAt(fridayAt1300Ms, 1) +
      buildFridayLineTextAt(fridayAt1300Ms + 2_000, 2) +
      buildFridayLineTextAt(fridayAt1300Ms + 4_000, 3).trimEnd();
    const cutAtCharacter = buildFridayLineTextAt(fridayAt1300Ms, 1).length + 1_000;
    const readingEveryLine = readEveryLine(lines);

    // Act: hand out the two chunks, each when it is asked for, then end the stream.
    await letPendingPromisesSettle();
    chunks.handOutTheNextChunk(wholeText.slice(0, cutAtCharacter));
    await letPendingPromisesSettle();
    chunks.handOutTheNextChunk(wholeText.slice(cutAtCharacter));
    await letPendingPromisesSettle();
    chunks.endTheStream();
    const linesRead = await readingEveryLine;

    // Assert: the three lines, in order, the cut one whole.
    expect(
      linesRead.map((line) => [line.atMs, line.snapshotNumber]),
      'every line must be read whole, the cut one and the one with no newline included',
    ).toEqual([
      [fridayAt1300Ms, 1],
      [fridayAt1300Ms + 2_000, 2],
      [fridayAt1300Ms + 4_000, 3],
    ]);
  });

  it('skips blank and damaged lines, and reads a line ending in "\\r\\n" whole', async () => {
    // Arrange: one chunk holding the 13:00:00 line ending in "\r\n" (a file saved on
    // Windows), a blank line, a line cut off by a power cut, and the 13:00:02 line.
    const chunks = createChunksHandedOutByHand();
    const lines = readRecordedLinesOneChunkAtATime(chunks.chunks);
    const lineEndingInCarriageReturn = buildFridayLineTextAt(fridayAt1300Ms, 1).replace(
      /\n$/,
      '\r\n',
    );
    const lineCutOffByAPowerCut = `${buildFridayLineTextAt(fridayAt1300Ms + 1_000, 2).slice(0, 500)}\n`;
    const chunk =
      lineEndingInCarriageReturn +
      '\n' +
      lineCutOffByAPowerCut +
      buildFridayLineTextAt(fridayAt1300Ms + 2_000, 3);
    const readingEveryLine = readEveryLine(lines);

    // Act: hand out the chunk, then end the stream.
    await letPendingPromisesSettle();
    chunks.handOutTheNextChunk(chunk);
    await letPendingPromisesSettle();
    chunks.endTheStream();
    const linesRead = await readingEveryLine;

    // Assert: the two good lines, nothing in their place for the blank and damaged ones.
    expect(
      linesRead.map((line) => line.atMs),
      'only the whole recorded lines must be handed over',
    ).toEqual([fridayAt1300Ms, fridayAt1300Ms + 2_000]);
  });
});
