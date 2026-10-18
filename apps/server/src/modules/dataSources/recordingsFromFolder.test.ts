/**
 * Listing the recordings from the recordings folder at boot (apps/server)
 *
 * What this module is for:
 *   The `recordings` slice is never saved in the database: the files are the truth. At
 *   boot the server reads `<recordings folder>/<sourceId>/*.jsonl` and lists one closed
 *   recording per file: its start read from the file name, its end and its count read
 *   from its last whole line, which carries its own number (a restart closes every
 *   recording, decision D13). A source that was deleted keeps its recordings, named
 *   after the source id. Only the first and the last lines are read, so a boot does not
 *   slow down with every hour recorded (gate 2 on PR #16).
 *
 * What these tests prove (real files in a temporary folder):
 *   - One entry per file, counted by its last line's number, closed at its last line,
 *     named after the current label of its source, or the source id when the source is
 *     gone; oldest first.
 *   - A folder that does not exist yet (a new machine) lists nothing.
 *   - A last line cut off (a power cut, a full disk) is skipped with a warning naming
 *     the file: the line before it gives the end and the count.
 *   - A file not named after a moment starts at its first line; a file with no good line
 *     starts and ends at its name's moment; a file with neither is skipped with a warning.
 *   - A recording started in the same millisecond as another (`…Z-2.jsonl`) starts at
 *     the moment in its name, and recordings of one millisecond are listed by their
 *     number (1, 2, 10), as they were started.
 *   - A file whose lines carry no number (written before gate 2) is counted by its lines.
 *   - Files that are not .jsonl, and folders named like one, are not recordings.
 *   - A recordings "folder" that cannot be read (a plain file in its place) lists
 *     nothing, with a warning, instead of stopping the server from starting.
 *
 * What these tests deliberately do not cover:
 *   - The store calling this at boot; dataSourceRestart.test.ts restarts a real store on
 *     a folder.
 *   - A file the server may not read (no permission): it is skipped with a warning like
 *     the folder above, but a test run as root could read it anyway.
 *   - Listing a recording of 2 000 lines of 60 cars quickly;
 *     recordingsFromFolderLargeRecording.test.ts covers it.
 *   - Checking each line's shapes, or any line between the first and the last: the
 *     replay skips a damaged line when it reads a recording.
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

/**
 * One recorded line, as the recorder writes it: its moment, its number in the file and
 * the green-flag session at that moment.
 */
function buildRecordedLineText(atMs: number, snapshotNumber: number): string {
  const shapes = { session: buildGreenFlagSessionAt(atMs) };
  return `${JSON.stringify({ atMs, snapshotNumber, shapes })}\n`;
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
      buildRecordedLineText(fridayAt1300Ms + 2_000, 1),
      buildRecordedLineText(fridayAt1300Ms + 4_000, 2),
      buildRecordedLineText(fridayAt1300Ms + 6_000, 3),
    ]);
    writeRecordingFile(recordingsFolder, 'fonte-cronometragem', '2027-08-12T10-00-00.000Z.jsonl', [
      buildRecordedLineText(thursdayAt1000Ms + 1_000, 1),
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

  it('skips a cut-off last line, with a warning, and ends at the line before it', () => {
    // Arrange: a recording whose third line was cut off by a power cut.
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeRecordingFile(recordingsFolder, 'simulador-enduro', '2027-08-13T13-00-00.000Z.jsonl', [
      buildRecordedLineText(fridayAt1300Ms + 2_000, 1),
      buildRecordedLineText(fridayAt1300Ms + 4_000, 2),
      '{"atMs":1805468406000,"snapshotNumber":3,"shapes":{"sess',
    ]);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: read the folder.
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      logger,
    );

    // Assert: two snapshots counted, the end at the second line, one warning.
    expect(
      recordings.map((recording) => [recording.snapshotCount, recording.endedAtMs]),
      'the cut-off line was never fully written, so it does not count',
    ).toEqual([[2, fridayAt1300Ms + 4_000]]);
    const warnings = readRecordedLines().filter((line) => line.level === 'warn');
    expect(
      warnings.map((line) => [line.message, line.recording_id]),
      'the cut-off line must leave a warning naming the file',
    ).toEqual([
      [
        'recording last line skipped: not a whole recorded snapshot',
        'simulador-enduro/2027-08-13T13-00-00.000Z.jsonl',
      ],
    ]);
  });

  const unusualFileScenarios = [
    // Someone renamed the file by hand: the first line says when the data starts.
    {
      name: 'starts a file not named after a moment at its first line',
      fileName: 'treino-de-sexta.jsonl',
      lineTexts: [
        buildRecordedLineText(fridayAt1300Ms + 2_000, 1),
        buildRecordedLineText(fridayAt1300Ms + 4_000, 2),
      ],
      expectedTimes: { startedAtMs: fridayAt1300Ms + 2_000, endedAtMs: fridayAt1300Ms + 4_000 },
      expectedSnapshotCount: 2,
    },
    // "Gravar", "Parar" and "Gravar" in one millisecond: the second file carries a number
    // after the moment, and still starts at that moment (gate 2 on PR #16).
    {
      name: 'starts a second recording of the same millisecond at the moment in its name',
      fileName: '2027-08-13T13-00-00.000Z-2.jsonl',
      lineTexts: [buildRecordedLineText(fridayAt1300Ms, 1)],
      expectedTimes: { startedAtMs: fridayAt1300Ms, endedAtMs: fridayAt1300Ms },
      expectedSnapshotCount: 1,
    },
    // A file written before lines carried their number (this branch before gate 2): its
    // lines are counted instead, a slower read kept for those files only.
    {
      name: 'counts the lines of a file whose lines carry no number',
      fileName: '2027-08-13T13-00-00.000Z.jsonl',
      lineTexts: [
        `${JSON.stringify({ atMs: fridayAt1300Ms + 2_000, shapes: {} })}\n`,
        `${JSON.stringify({ atMs: fridayAt1300Ms + 4_000, shapes: {} })}\n`,
        `${JSON.stringify({ atMs: fridayAt1300Ms + 6_000, shapes: {} })}\n`,
      ],
      expectedTimes: { startedAtMs: fridayAt1300Ms, endedAtMs: fridayAt1300Ms + 6_000 },
      expectedSnapshotCount: 3,
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

  it('lists the recordings of one millisecond in the order they were started', () => {
    // Arrange: three recordings of Friday 13:00:00.000, written in a jumbled order: the
    // first (no number), the tenth and the second.
    const recordingsFolder = createTemporaryRecordingsFolder();
    const fileNamesInStartOrder = [
      '2027-08-13T13-00-00.000Z.jsonl',
      '2027-08-13T13-00-00.000Z-2.jsonl',
      '2027-08-13T13-00-00.000Z-10.jsonl',
    ];
    const fileNamesInWritingOrder = [
      '2027-08-13T13-00-00.000Z-10.jsonl',
      '2027-08-13T13-00-00.000Z.jsonl',
      '2027-08-13T13-00-00.000Z-2.jsonl',
    ];
    for (const fileName of fileNamesInWritingOrder) {
      writeRecordingFile(recordingsFolder, 'simulador-enduro', fileName, [
        buildRecordedLineText(fridayAt1300Ms, 1),
      ]);
    }

    // Act: read the folder.
    const recordings = readRecordingsFromFolder(
      recordingsFolder,
      [buildEnduroSimulatorTurnedOff()],
      silentLogger,
    );

    // Assert: first, second, tenth, as the live list had them before the restart.
    expect(
      recordings.map((recording) => recording.fileName),
      'recordings of one millisecond must be ordered by their number (1, 2, 10), not by text',
    ).toEqual(fileNamesInStartOrder);
  });

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
      buildRecordedLineText(fridayAt1300Ms + 2_000, 1),
    ]);
    writeRecordingFile(recordingsFolder, 'simulador-enduro', 'anotacoes.txt', ['treino ok\n']);
    writeRecordingFile(recordingsFolder, 'simulador-enduro', '2027-08-13T13-00-00.000Z.jsonl~', [
      buildRecordedLineText(fridayAt1300Ms + 2_000, 1),
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
      buildRecordedLineText(fridayAt1300Ms + 2_000, 1),
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
