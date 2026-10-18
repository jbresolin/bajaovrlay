// The `recordings` slice rebuilt from the recordings folder at boot. The slice is never
// saved in the database: the files are the truth, so a recording copied in, or deleted,
// by hand shows up (or goes) at the next boot.
import { type Dirent, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DataSource, Recording } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { readStartMomentFromRecordingFileName } from './recordingBookkeeping.js';
import { parseRecordingLineMoment, splitRecordingTextIntoLines } from './recordingLine.js';

/** Where the recordings live inside DATA_DIR: `<dataFolder>/recordings/<sourceId>/`. */
export function buildRecordingsFolderPath(dataFolder: string): string {
  return join(dataFolder, 'recordings');
}

/**
 * Lists every recording in `<recordingsFolder>/<sourceId>/*.jsonl`, oldest first, as the
 * store holds them after a restart: every one closed, because a restart closes the
 * recordings and no source comes back recording (decision D13).
 * - snapshotCount is the number of lines with a moment; endedAtMs the last such moment.
 * - startedAtMs is the moment in the file name (the same value the slice held before
 *   the restart); a file renamed by hand starts at its first line instead.
 * - sourceLabel is the source's current label, or its id when the source was deleted:
 *   the file does not hold the label, and the id still tells the operator whose it was.
 * A line with no moment (cut off by a power cut, edited by hand) is skipped with a
 * warning; a file with no moment at all, in its name or its lines, is skipped too.
 * A missing folder (a new machine) lists nothing.
 * Nothing here may stop the server from starting (it runs inside the boot, and the list
 * is only a listing): a folder or a file that cannot be read (a plain file where the
 * folder should be, no permission) is skipped with a warning, and an entry that is not a
 * plain file (a folder named `….jsonl`) is not a recording.
 */
export function readRecordingsFromFolder(
  recordingsFolder: string,
  dataSources: DataSource[],
  logger: ServerLogger,
): Recording[] {
  if (!existsSync(recordingsFolder)) {
    return [];
  }
  const recordings: Recording[] = [];
  const sourceFolders = readFolderEntriesOrWarn(recordingsFolder, logger).filter((entry) =>
    entry.isDirectory(),
  );
  for (const sourceFolder of sourceFolders) {
    const sourceId = sourceFolder.name;
    const source = dataSources.find((candidate) => candidate.id === sourceId);
    const sourceLabel = source?.label ?? sourceId;
    const recordingFiles = readFolderEntriesOrWarn(join(recordingsFolder, sourceId), logger).filter(
      (entry) => entry.isFile() && entry.name.endsWith('.jsonl'),
    );
    for (const recordingFile of recordingFiles) {
      const fileName = recordingFile.name;
      const recording = readOneRecordingFile({
        recordingsFolder,
        sourceId,
        sourceLabel,
        fileName,
        logger,
      });
      if (recording !== undefined) {
        recordings.push(recording);
      }
    }
  }
  return recordings.sort(compareRecordingsOldestFirst);
}

/** The entries of a folder, or none, with a warning, when the folder cannot be read. */
function readFolderEntriesOrWarn(folderPath: string, logger: ServerLogger): Dirent[] {
  try {
    return readdirSync(folderPath, { withFileTypes: true });
  } catch (readError) {
    logger.warn(
      { folder: folderPath, error: describeError(readError) },
      'recordings folder skipped: unreadable',
    );
    return [];
  }
}

/** The text of a recording file, or undefined, with a warning, when it cannot be read. */
function readRecordingFileTextOrWarn(
  filePath: string,
  recordingId: string,
  logger: ServerLogger,
): string | undefined {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (readError) {
    logger.warn(
      { recording_id: recordingId, error: describeError(readError) },
      'recording skipped: file unreadable',
    );
    return undefined;
  }
}

/** The message of an error, for the log. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads one recording file into its closed entry, or undefined when it cannot be read or
 * has no moment at all.
 */
function readOneRecordingFile(file: {
  recordingsFolder: string;
  sourceId: string;
  sourceLabel: string;
  fileName: string;
  logger: ServerLogger;
}): Recording | undefined {
  const recordingId = `${file.sourceId}/${file.fileName}`;
  const fileText = readRecordingFileTextOrWarn(
    join(file.recordingsFolder, file.sourceId, file.fileName),
    recordingId,
    file.logger,
  );
  if (fileText === undefined) {
    return undefined;
  }
  const lineMomentsMs: number[] = [];
  splitRecordingTextIntoLines(fileText).forEach((lineText, index) => {
    const lineMomentMs = parseRecordingLineMoment(lineText);
    if (lineMomentMs === undefined) {
      file.logger.warn(
        { recording_id: recordingId, line_number: index + 1 },
        'recording line skipped: not a recorded snapshot',
      );
      return;
    }
    lineMomentsMs.push(lineMomentMs);
  });

  const firstLineMomentMs = lineMomentsMs[0];
  const lastLineMomentMs = lineMomentsMs.at(-1);
  const startedAtMs = readStartMomentFromRecordingFileName(file.fileName) ?? firstLineMomentMs;
  if (startedAtMs === undefined) {
    file.logger.warn(
      { recording_id: recordingId },
      'recording skipped: no moment in its name and no good line',
    );
    return undefined;
  }
  return {
    id: recordingId,
    sourceId: file.sourceId,
    sourceLabel: file.sourceLabel,
    fileName: file.fileName,
    startedAtMs,
    // A recording with no line ends where it started: it holds no time at all.
    endedAtMs: lastLineMomentMs ?? startedAtMs,
    snapshotCount: lineMomentsMs.length,
  };
}

/** Orders recordings by start, then by id, so the list reads the same at every boot. */
function compareRecordingsOldestFirst(first: Recording, second: Recording): number {
  if (first.startedAtMs !== second.startedAtMs) {
    return first.startedAtMs - second.startedAtMs;
  }
  return first.id.localeCompare(second.id);
}
