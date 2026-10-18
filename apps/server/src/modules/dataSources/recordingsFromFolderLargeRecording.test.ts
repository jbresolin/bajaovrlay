/**
 * Listing a large recording at boot (apps/server)
 *
 * What this module is for:
 *   An enduro recording holds thousands of lines of 60 cars. The boot listing reads only
 *   the two ends of each file (the name gives the start; the last whole line gives the
 *   end and the count), so a boot does not slow down with every hour recorded (gate 2 on
 *   PR #16).
 *
 * What these tests prove (a real 50 MB file in a temporary folder):
 *   - A recording of 2 000 lines of 60 cars (about 50 MB) is listed, with its count and
 *     its end, in under largestBootListingTimeMs.
 *
 * What these tests deliberately do not cover:
 *   - The listing's rules (labels, cut-off lines, order, unreadable files);
 *     recordingsFromFolder.test.ts covers them.
 */
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import {
  fileNameOfTheLargeRecording,
  lineCountOfTheLargeRecording,
  startOfTheLargeRecordingMs,
  writeTheLargeRecordingInto,
} from './largeRecording.testSupport.js';
import { createTemporaryRecordingsFolder } from './recorder.testSupport.js';
import { readRecordingsFromFolder } from './recordingsFromFolder.js';
import { buildEnduroSimulatorTurnedOff } from './reducers/dataSourceSlices.testSupport.js';

const silentLogger = createLogger({ level: 'silent' });

/**
 * How long listing one large recording may take. Reading two short ends of a file takes
 * a few milliseconds even on a slow CI machine; reading and parsing all of its 50 MB took
 * several times this, so the bound tells the two apart without being flaky.
 */
const largestBootListingTimeMs = 100;

describe('readRecordingsFromFolder, on a large recording', () => {
  it('lists a recording of 2 000 lines of 60 cars quickly, reading only its two ends', () => {
    // Arrange: an hour of the simulator's 60-car enduro on disk, about 50 MB.
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeTheLargeRecordingInto(recordingsFolder);

    // Act: read the folder, timing it.
    const startedAtMs = performance.now();
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      silentLogger,
    );
    const listingTimeMs = performance.now() - startedAtMs;

    // Assert: the recording with its count and end, listed within the bound.
    expect(
      recordings.map((recording) => [
        recording.fileName,
        recording.snapshotCount,
        recording.endedAtMs,
      ]),
      'the count and the end must come from the last line',
    ).toEqual([
      [
        fileNameOfTheLargeRecording,
        lineCountOfTheLargeRecording,
        startOfTheLargeRecordingMs + (lineCountOfTheLargeRecording - 1) * 2_000,
      ],
    ]);
    expect(
      listingTimeMs,
      `listing must read two ends of the file, not 50 MB (under ${String(largestBootListingTimeMs)} ms)`,
    ).toBeLessThan(largestBootListingTimeMs);
  });
});
