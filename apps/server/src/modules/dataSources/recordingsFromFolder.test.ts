/**
 * Listing the recordings from the recordings folder at boot (apps/server)
 *
 * What this module is for:
 *   The `recordings` slice is never saved in the database: the files are the truth. At
 *   boot the server reads `<recordings folder>/<sourceId>/*.jsonl` and lists one closed
 *   recording per file: its lines counted, its start read from the file name, its end at
 *   its last line (a restart closes every recording, decision D13). A source that was
 *   deleted keeps its recordings, named after the source id.
 *
 * What these tests prove (real files in a temporary folder):
 *   - One entry per file, counted, closed at its last line, named after the current
 *     label of its source, or the source id when the source is gone; oldest first.
 *   - A folder that does not exist yet (a new machine) lists nothing.
 *   - A line that is not a recorded snapshot is skipped with a warning naming the file.
 *   - A file not named after a moment starts at its first line; a file with no good line
 *     starts and ends at its name's moment; a file with neither is skipped with a warning.
 *   - Files that are not .jsonl, and folders named like one, are not recordings.
 *   - A recordings "folder" that cannot be read (a plain file in its place) lists
 *     nothing, with a warning, instead of stopping the server from starting.
 *
 * What these tests deliberately do not cover:
 *   - The store calling this at boot; dataSourceRestart.test.ts restarts a real store on
 *     a folder.
 *   - A file the server may not read (no permission): it is skipped with a warning like
 *     the folder above, but a test run as root could read it anyway.
 *   - Checking each line's shapes: the replay does that when it reads a recording.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import { createTemporaryRecordingsFolder } from './recorder.testSupport.js';
import { readRecordingsFromFolder } from './recordingsFromFolder.js';
import {
  buildEnduroSimulatorTurnedOff,
  buildGreenFlagSessionAt,
} from './reducers/dataSourceSlices.testSupport.js';

const silentLogger = createLogger({ level: 'silent' });
const fridayAt1300Ms = Date.parse('2027-08-13T13:00:00.000Z');
const thursdayAt1000Ms = Date.parse('2027-08-12T10:00:00.000Z');

/** One recorded line, as the recorder writes it: the green-flag session at a moment. */
function buildRecordedLineText(atMs: number): string {
  return `${JSON.stringify({ atMs, shapes: { session: buildGreenFlagSessionAt(atMs) } })}\n`;
}

/** Writes a recording file of a source, holding the given lines, in a recordings folder. */
function writeRecordingFile(
  recordingsFolder: string,
  sourceId: string,
  fileName: string,
  lineTexts: string[],
): void {
  mkdirSync(join(recordingsFolder, sourceId), { recursive: true });
  writeFileSync(join(recordingsFolder, sourceId, fileName), lineTexts.join(''));
}

describe('readRecordingsFromFolder', () => {
  it('lists one closed recording per file, counted, named after its source, oldest first', () => {
    // Arrange: Friday's simulator recording (three lines, two seconds apart), and
    // Thursday's recording of a source deleted since ("fonte-cronometragem").
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeRecordingFile(recordingsFolder, 'simulador-enduro', '2027-08-13T13-00-00.000Z.jsonl', [
      buildRecordedLineText(fridayAt1300Ms + 2_000),
      buildRecordedLineText(fridayAt1300Ms + 4_000),
      buildRecordedLineText(fridayAt1300Ms + 6_000),
    ]);
    writeRecordingFile(recordingsFolder, 'fonte-cronometragem', '2027-08-12T10-00-00.000Z.jsonl', [
      buildRecordedLineText(thursdayAt1000Ms + 1_000),
    ]);

    // Act: read the folder, with only the simulator still a source.
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      silentLogger,
    );

    // Assert: Thursday's first, then Friday's; each closed at its last line.
    expect(recordings, 'each file must come back as one closed recording').toEqual([
      {
        id: 'fonte-cronometragem/2027-08-12T10-00-00.000Z.jsonl',
        sourceId: 'fonte-cronometragem',
        sourceLabel: 'fonte-cronometragem',
        fileName: '2027-08-12T10-00-00.000Z.jsonl',
        startedAtMs: thursdayAt1000Ms,
        endedAtMs: thursdayAt1000Ms + 1_000,
        snapshotCount: 1,
      },
      {
        id: 'simulador-enduro/2027-08-13T13-00-00.000Z.jsonl',
        sourceId: 'simulador-enduro',
        sourceLabel: 'Simulador — Enduro',
        fileName: '2027-08-13T13-00-00.000Z.jsonl',
        startedAtMs: fridayAt1300Ms,
        endedAtMs: fridayAt1300Ms + 6_000,
        snapshotCount: 3,
      },
    ]);
  });

  it('lists nothing when the recordings folder does not exist yet', () => {
    // Arrange: a folder path nobody has made (a new machine, nothing recorded yet).
    const missingRecordingsFolder = join(createTemporaryRecordingsFolder(), 'ainda-nao-existe');

    // Act: read it.
    const recordings = readRecordingsFromFolder(
      missingRecordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      silentLogger,
    );

    // Assert: no recording, and no error.
    expect(recordings, 'a missing folder means no recording yet').toEqual([]);
  });

  it('skips a line that is not a recorded snapshot, with a warning naming the file and line', () => {
    // Arrange: a recording whose second line was cut off by a power cut, and whose third
    // has no moment.
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeRecordingFile(recordingsFolder, 'simulador-enduro', '2027-08-13T13-00-00.000Z.jsonl', [
      buildRecordedLineText(fridayAt1300Ms + 2_000),
      '{"atMs":18054684040\n',
      '{"shapes":{}}\n',
      buildRecordedLineText(fridayAt1300Ms + 8_000),
    ]);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: read the folder.
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      logger,
    );

    // Assert: two snapshots counted, the end at the last good line, two warnings.
    expect(
      recordings.map((recording) => [recording.snapshotCount, recording.endedAtMs]),
      'only the good lines count',
    ).toEqual([[2, fridayAt1300Ms + 8_000]]);
    const warnings = readRecordedLines().filter((line) => line.level === 'warn');
    expect(
      warnings.map((line) => [line.message, line.recording_id, line.line_number]),
      'each skipped line must leave a warning naming the file and the line',
    ).toEqual([
      [
        'recording line skipped: not a recorded snapshot',
        'simulador-enduro/2027-08-13T13-00-00.000Z.jsonl',
        2,
      ],
      [
        'recording line skipped: not a recorded snapshot',
        'simulador-enduro/2027-08-13T13-00-00.000Z.jsonl',
        3,
      ],
    ]);
  });

  const unusualFileScenarios = [
    // Someone renamed the file by hand: the first line says when the data starts.
    {
      name: 'starts a file not named after a moment at its first line',
      fileName: 'treino-de-sexta.jsonl',
      lineTexts: [
        buildRecordedLineText(fridayAt1300Ms + 2_000),
        buildRecordedLineText(fridayAt1300Ms + 4_000),
      ],
      expectedTimes: { startedAtMs: fridayAt1300Ms + 2_000, endedAtMs: fridayAt1300Ms + 4_000 },
      expectedSnapshotCount: 2,
    },
    // A file whose only line was cut off by a power cut: it starts and ends at the moment
    // in its name.
    {
      name: 'starts and ends a file with no good line at the moment in its name',
      fileName: '2027-08-13T13-00-00.000Z.jsonl',
      lineTexts: ['{"atMs":'],
      expectedTimes: { startedAtMs: fridayAt1300Ms, endedAtMs: fridayAt1300Ms },
      expectedSnapshotCount: 0,
    },
  ];

  it.each(unusualFileScenarios)(
    '$name',
    ({ fileName, lineTexts, expectedTimes, expectedSnapshotCount }) => {
      // Arrange: this row's file in the simulator's folder.
      const recordingsFolder = createTemporaryRecordingsFolder();
      writeRecordingFile(recordingsFolder, 'simulador-enduro', fileName, lineTexts);

      // Act: read the folder.
      const recordings = readRecordingsFromFolder(
        recordingsFolder,
        [buildEnduroSimulatorTurnedOff()],
        silentLogger,
      );

      // Assert: the recording, with this row's start, end and count.
      expect(
        recordings.map((recording) => ({
          startedAtMs: recording.startedAtMs,
          endedAtMs: recording.endedAtMs,
        })),
        'the start and end must come from the name or the lines, as this row says',
      ).toEqual([expectedTimes]);
      expect(
        recordings.map((recording) => recording.snapshotCount),
        'the count must be the good lines',
      ).toEqual([expectedSnapshotCount]);
    },
  );

  it('skips, with a warning, a file with neither a moment in its name nor a good line', () => {
    // Arrange: an empty file with a hand-made name.
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeRecordingFile(recordingsFolder, 'simulador-enduro', 'vazio.jsonl', []);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: read the folder.
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      logger,
    );

    // Assert: nothing listed; a warning names the file.
    expect(recordings, 'a recording with no moment at all cannot be listed').toEqual([]);
    const warnings = readRecordedLines().filter((line) => line.level === 'warn');
    expect(
      warnings.map((line) => [line.message, line.recording_id]),
      'the skipped file must leave a warning',
    ).toEqual([
      ['recording skipped: no moment in its name and no good line', 'simulador-enduro/vazio.jsonl'],
    ]);
  });

  it('leaves out files that are not recordings', () => {
    // Arrange: a note and a copy left by a text editor next to a real recording.
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeRecordingFile(recordingsFolder, 'simulador-enduro', '2027-08-13T13-00-00.000Z.jsonl', [
      buildRecordedLineText(fridayAt1300Ms + 2_000),
    ]);
    writeRecordingFile(recordingsFolder, 'simulador-enduro', 'anotacoes.txt', ['treino ok\n']);
    writeRecordingFile(recordingsFolder, 'simulador-enduro', '2027-08-13T13-00-00.000Z.jsonl~', [
      buildRecordedLineText(fridayAt1300Ms + 2_000),
    ]);

    // Act: read the folder.
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      silentLogger,
    );

    // Assert: only the .jsonl file is a recording.
    expect(
      recordings.map((recording) => recording.fileName),
      'only .jsonl files are recordings',
    ).toEqual(['2027-08-13T13-00-00.000Z.jsonl']);
  });

  it('leaves out a folder named like a recording', () => {
    // Arrange: a real recording, and next to it a folder someone named like one.
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeRecordingFile(recordingsFolder, 'simulador-enduro', '2027-08-13T13-00-00.000Z.jsonl', [
      buildRecordedLineText(fridayAt1300Ms + 2_000),
    ]);
    mkdirSync(join(recordingsFolder, 'simulador-enduro', '2027-08-13T15-00-00.000Z.jsonl'));

    // Act: read the folder.
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      silentLogger,
    );

    // Assert: only the file is a recording, and reading did not fail.
    expect(
      recordings.map((recording) => recording.fileName),
      'a folder is never a recording, whatever its name',
    ).toEqual(['2027-08-13T13-00-00.000Z.jsonl']);
  });

  it('lists nothing, with a warning, when the recordings folder is a plain file', () => {
    // Arrange: a plain file where the recordings folder should be (copied by hand).
    const dataFolder = createTemporaryRecordingsFolder();
    const recordingsFolderThatIsAFile = join(dataFolder, 'recordings');
    writeFileSync(recordingsFolderThatIsAFile, 'não é uma pasta');
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: read it.
    const recordings = readRecordingsFromFolder(
      recordingsFolderThatIsAFile,
      [buildEnduroSimulatorTurnedOff()],
      logger,
    );

    // Assert: no recording and a warning, so the server still starts.
    expect(recordings, 'a folder that cannot be read lists no recording').toEqual([]);
    const warnings = readRecordedLines().filter((line) => line.level === 'warn');
    expect(
      warnings.map((line) => [line.message, line.folder]),
      'the unreadable folder must leave a warning naming it',
    ).toEqual([['recordings folder skipped: unreadable', recordingsFolderThatIsAFile]]);
  });
});
