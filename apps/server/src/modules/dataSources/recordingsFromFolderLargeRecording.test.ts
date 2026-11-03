/**
 * Listing a large recording at boot (apps/server)
 *
 * What this module is for:
 *   An enduro recording holds thousands of lines of 60 cars. The boot listing reads only
 *   the two ends of each file (the name gives the start; the last whole line gives the
 *   end and the count), so a boot does not slow down with every hour recorded (gate 2 on
 *   PR #16).
 *
 * What these tests prove (a real 1.5 MB file in a temporary folder, every byte read from
 *   a file counted):
 *   - A recording of 40 lines of 60 cars is listed with its count and its end, reading
 *     at most largestBytesReadToListIt of it: its last lines, never the whole file.
 *     Counting bytes, not milliseconds, keeps the check the same on a busy CI core; it
 *     once timed a 78 MB file against 100 ms (BAJAOVRLAY-52). Reading the whole file
 *     (the old line count, or readFileSync) reads all of it and fails at once.
 *
 * What these tests deliberately do not cover:
 *   - The listing's rules (labels, cut-off lines, order, unreadable files);
 *     recordingsFromFolder.test.ts covers them.
 *   - A read through a stream or a promise: the listing runs inside the boot and reads
 *     synchronously (readSync), so only the synchronous reads are counted.
 */
import type * as nodeFs from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import {
  fileNameOfTheLargeRecording,
  startOfTheLargeRecordingMs,
  writeTheLargeRecordingInto,
} from './largeRecording.testSupport.js';
import { createTemporaryRecordingsFolder } from './recorder.testSupport.js';
import { readRecordingsFromFolder } from './recordingsFromFolder.js';
import { buildEnduroSimulatorTurnedOff } from './reducers/dataSourceSlices.testSupport.js';

// Every byte read from a file in this test file, counted by the two reads below. vi.mock
// runs before the imports, so the counter must be created with vi.hoisted to exist then.
const bytesReadFromFiles = vi.hoisted(() => ({ count: 0 }));

// node:fs as it is, except that readSync and readFileSync add what they read to the
// counter. The listing (and recordingFileEnds.ts under it) imports node:fs, so its reads
// go through these.
vi.mock('node:fs', async (importOriginal) => {
  const actualFs = await importOriginal<typeof nodeFs>();
  function readSyncCountingBytes(...readArguments: unknown[]): number {
    const readSync = actualFs.readSync as (...anyArguments: unknown[]) => number;
    const bytesRead = readSync(...readArguments);
    bytesReadFromFiles.count += bytesRead;
    return bytesRead;
  }
  function readFileSyncCountingBytes(...readArguments: unknown[]): string | Buffer {
    const readFileSync = actualFs.readFileSync as (...anyArguments: unknown[]) => string | Buffer;
    const fileContents = readFileSync(...readArguments);
    bytesReadFromFiles.count += Buffer.byteLength(fileContents);
    return fileContents;
  }
  return { ...actualFs, readSync: readSyncCountingBytes, readFileSync: readFileSyncCountingBytes };
});

const silentLogger = createLogger({ level: 'silent' });

/**
 * How many lines the recording holds: 40 lines of 60 cars, about 39 KB each, about 1.5 MB.
 * Eight times what the listing reads (largestBytesReadToListIt), so the end and the whole
 * file are far apart; small enough to write in a few tens of ms.
 */
const lineCountOfTheListedRecording = 40;

/**
 * The most the listing may read of that recording: 192 KB. It reads 64 KB from the end
 * (recordingFileEnds.ts); two 39 KB lines do not fit in that, so it reads again, 128 KB,
 * and holds them. The whole file is about eight times this.
 */
const largestBytesReadToListIt = (64 + 128) * 1024;

describe('readRecordingsFromFolder, on a large recording', () => {
  beforeEach(() => {
    bytesReadFromFiles.count = 0;
  });

  it('lists a recording of 40 lines of 60 cars reading only its end, never the whole file', () => {
    // Arrange: 80 s of the simulator's 60-car enduro on disk, about 1.5 MB, and the byte
    // counter set back to zero once it is written.
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeTheLargeRecordingInto(recordingsFolder, lineCountOfTheListedRecording);
    bytesReadFromFiles.count = 0;

    // Act: list the folder, as the boot does.
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      silentLogger,
    );

    // Assert: the recording with its count and end, from its last line, and only its end
    // read.
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
        lineCountOfTheListedRecording,
        startOfTheLargeRecordingMs + (lineCountOfTheListedRecording - 1) * 2_000,
      ],
    ]);
    expect(
      bytesReadFromFiles.count,
      `listing must read the end of the file, not all of its 1.5 MB (at most ${String(largestBytesReadToListIt)} bytes)`,
    ).toBeLessThanOrEqual(largestBytesReadToListIt);
  });
});
