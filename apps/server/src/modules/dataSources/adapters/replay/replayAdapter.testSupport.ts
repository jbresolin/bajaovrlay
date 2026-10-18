// Test support for the replay adapter tests: Friday's recording written to a new
// temporary recordings folder as the recorder writes it, a replay of it turned on at
// 15:00 on the enduro day, and the context of a poll at a moment. Every call builds new
// objects and its own folder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ReplayConfig } from '@bajaovrlay/shared';

import { createTemporaryRecordingsFolder } from '../../recorder.testSupport.js';
import { buildRecordingLineText } from '../../recordingLine.js';
import type { DataSourcePollContext } from '../dataSourceAdapter.js';
import { buildFridayRecordingLines } from './fridayTraining.testSupport.js';

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
