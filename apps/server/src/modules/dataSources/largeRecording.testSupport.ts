// Test support: a large recording on disk, about an hour of a 60-car enduro, for the
// benchmark that times how long loading it holds the server
// (replayLoading.benchmark.ts), and its first 40 lines for the tests that check a
// recording is listed and loaded. Each line holds the simulator's 60 cars (session,
// positions and standings), as the recorder writes them, so a line is about 39 KB, like
// a real one. Every call writes a new file.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { DataSnapshotShapes } from '@bajaovrlay/shared';

import { buildShapesFromRaceState } from './adapters/simulator/shapesFromRaceState.js';
import { simulateEnduroAt } from './adapters/simulator/simulateEnduro.js';
import { buildRecordingLineText } from './recordingLine.js';

/**
 * How many lines the large recording holds: 2 000 polls two seconds apart, an hour and
 * six minutes of a 60-car enduro, about 78 MB. That is large enough for the event-loop
 * stall the benchmark prints (adapters/replay/replayLoading.benchmark.ts) to tell a
 * whole-file read from a streamed one. The tests write only 40 lines (about 1.5 MB): they
 * check what is read, not how long it takes (BAJAOVRLAY-52). A whole 4-hour enduro (7 200 lines, 180 MB) would make the test itself spend
 * seconds writing.
 */
export const lineCountOfTheLargeRecording = 2_000;

/** 14:00:00 UTC on 14 August 2027: the first line of the large recording. */
export const startOfTheLargeRecordingMs = Date.parse('2027-08-14T14:00:00.000Z');

/** The file name of the large recording, named after its start as the recorder does. */
export const fileNameOfTheLargeRecording = '2027-08-14T14-00-00.000Z.jsonl';

/** The shapes of the simulator's 60-car enduro, one hour in, dated at a moment. */
function buildSixtyCarShapesAt(atMs: number): DataSnapshotShapes {
  const raceState = simulateEnduroAt(
    { seed: 2027, carCount: 60, sessionDurationMs: 14_400_000 },
    60 * 60 * 1_000,
  );
  return buildShapesFromRaceState(raceState, atMs);
}

/**
 * Writes the large recording of the simulator into a recordings folder:
 * `<recordingsFolder>/simulador-enduro/<fileNameOfTheLargeRecording>`. The race is the
 * same moment on every line (only the line's moment and number change): building 2 000
 * different moments would cost the test seconds and prove nothing more about loading.
 * Written in batches of 200 lines to keep the test's own memory low. `lineCount` writes
 * only the first lines (about 39 KB each), for a test that needs a smaller file.
 */
export function writeTheLargeRecordingInto(
  recordingsFolder: string,
  lineCount: number = lineCountOfTheLargeRecording,
): string {
  const filePath = join(recordingsFolder, 'simulador-enduro', fileNameOfTheLargeRecording);
  mkdirSync(dirname(filePath), { recursive: true });
  const shapes = buildSixtyCarShapesAt(startOfTheLargeRecordingMs);
  const linesPerBatch = 200;
  for (let batchStart = 0; batchStart < lineCount; batchStart += linesPerBatch) {
    const batchEnd = Math.min(batchStart + linesPerBatch, lineCount);
    const lineTexts: string[] = [];
    for (let lineIndex = batchStart; lineIndex < batchEnd; lineIndex += 1) {
      lineTexts.push(
        buildRecordingLineText({
          atMs: startOfTheLargeRecordingMs + lineIndex * 2_000,
          snapshotNumber: lineIndex + 1,
          shapes,
        }),
      );
    }
    appendFileSync(filePath, lineTexts.join(''), 'utf8');
  }
  return filePath;
}
