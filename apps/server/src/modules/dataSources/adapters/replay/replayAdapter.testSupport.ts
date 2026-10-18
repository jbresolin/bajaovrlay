// Test support for the replay adapter tests: Friday's recording written to a new
// temporary recordings folder as the recorder writes it, a replay of it turned on at
// 15:00 on the enduro day, the context of a poll at a moment, and a recording reader
// whose reads the test ends by hand, with a replay reading through it. Every call
// builds new objects and its own folder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ReplayConfig } from '@bajaovrlay/shared';

import { createTemporaryRecordingsFolder } from '../../recorder.testSupport.js';
import { buildRecordingLineText, type RecordedLine } from '../../recordingLine.js';
import type { DataSourcePollContext } from '../dataSourceAdapter.js';
import { buildFridayRecordingLines } from './fridayTraining.testSupport.js';
import { createReplayAdapter, type ReadRecordingFile } from './replayAdapter.js';

/** The id of Friday's recording: the simulator's, started at 13:00 on 13 August 2027. */
export const fridayRecordingId = 'simulador-enduro/2027-08-13T13-00-00.000Z.jsonl';
/** 15:00:00 UTC on 14 August 2027, the enduro day: the moment the replay was turned on. */
export const replayTurnedOnAtMs = Date.parse('2027-08-14T15:00:00.000Z');

/** Writes the given line texts as Friday's recording file into a new recordings folder. */
export function writeRecordingLineTextsIntoAFolder(lineTexts: string[]): string {
  const recordingsFolder = createTemporaryRecordingsFolder();
  mkdirSync(join(recordingsFolder, 'simulador-enduro'));
  writeFileSync(join(recordingsFolder, fridayRecordingId), lineTexts.join(''));
  return recordingsFolder;
}

/** Writes Friday's whole recording, as the recorder would, into a new recordings folder. */
export function writeFridayRecordingIntoAFolder(): string {
  const lines = buildFridayRecordingLines();
  const lineTexts = lines.map((line, index) =>
    buildRecordingLineText({ atMs: line.atMs, snapshotNumber: index + 1, shapes: line.shapes }),
  );
  return writeRecordingLineTextsIntoAFolder(lineTexts);
}

/** A replay of Friday's recording turned on at 15:00, at the given speed. */
export function buildFridayReplayConfig(speed: ReplayConfig['speed']): ReplayConfig {
  return {
    recordingId: fridayRecordingId,
    speed,
    isLooping: false,
    replayStartedAtMs: replayTurnedOnAtMs,
  };
}

/** The context of a poll made at a moment, with a signal that never fires. */
export function buildPollContextAt(nowMs: number): DataSourcePollContext {
  return { readCurrentTime: () => new Date(nowMs), signal: new AbortController().signal };
}

/** The id of a second recording of the simulator, Saturday's warm-up at 09:00. */
export const saturdayWarmUpRecordingId = 'simulador-enduro/2027-08-14T09-00-00.000Z.jsonl';

/**
 * A recording reader whose reads the test ends by hand, in the order they started:
 * finishTheOldestRead answers Friday's lines, failTheOldestRead rejects with the given
 * pt-BR reason. Keeps the id of every recording it was asked to read, so a test can see
 * when a recording was read and that it was read only once.
 */
export function createRecordingReaderFinishedByHand() {
  const pendingReads: Array<{ finish: () => void; fail: (reason: string) => void }> = [];
  const recordingIdsRead: string[] = [];
  const readRecordingFile: ReadRecordingFile = (_filePath, recordingId) => {
    recordingIdsRead.push(recordingId);
    return new Promise((resolve, reject) => {
      pendingReads.push({
        finish: () => resolve({ lines: buildFridayRecordedLines(), fileSizeInBytes: 2_000 }),
        fail: (reason) => reject(new Error(reason)),
      });
    });
  };

  /** Takes the oldest read still waiting off the list; fails the test if there is none. */
  function takeTheOldestPendingRead() {
    const oldestRead = pendingReads.shift();
    if (oldestRead === undefined) {
      throw new Error('no recording is being read');
    }
    return oldestRead;
  }

  return {
    readRecordingFile,
    readRecordingIdsRead: () => [...recordingIdsRead],
    countReadsInFlight: () => pendingReads.length,
    finishTheOldestRead: () => takeTheOldestPendingRead().finish(),
    failTheOldestRead: (reason: string) => takeTheOldestPendingRead().fail(reason),
  };
}

/** Friday's recording as the replay holds it once read: numbered lines, oldest first. */
function buildFridayRecordedLines(): RecordedLine[] {
  return buildFridayRecordingLines().map((line, index) => ({
    atMs: line.atMs,
    snapshotNumber: index + 1,
    shapes: line.shapes,
  }));
}

/** A replay adapter, of Friday's recording at 1×, reading through the given reader. */
export function createFridayReplayReadingThrough(
  recordingReader: ReturnType<typeof createRecordingReaderFinishedByHand>,
) {
  const replayAdapter = createReplayAdapter({
    recordingsFolder: '/dados/gravacoes',
    readRecordingFile: recordingReader.readRecordingFile,
  });
  return { replayAdapter, config: buildFridayReplayConfig(1) };
}

/** The context of a poll at 15:00:01, whose signal the given controller fires. */
export function buildPollContextFiredBy(abortController: AbortController): DataSourcePollContext {
  return {
    readCurrentTime: () => new Date(replayTurnedOnAtMs + 1_000),
    signal: abortController.signal,
  };
}

/** The error a poll rejected with, or undefined when it answered. */
export function captureThePollError(polling: Promise<unknown>): Promise<unknown> {
  return polling.then(
    () => undefined,
    (pollError: unknown) => pollError,
  );
}

/** Lets every promise that can settle now settle (a read ended, a poll answered). */
export function letPendingPromisesSettle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
