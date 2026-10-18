// The `recordings` slice rebuilt from the recordings folder at boot. The slice is never
// saved in the database: the files are the truth, so a recording copied in, or deleted,
// by hand shows up (or goes) at the next boot.
import { closeSync, type Dirent, existsSync, fstatSync, openSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { DataSource, Recording } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import {
  readRecordingNumberFromRecordingFileName,
  readStartMomentFromRecordingFileName,
} from './recordingBookkeeping.js';
import {
  countTheWholeLinesOfAFile,
  readTheEndOfARecordingFile,
  readTheFirstLineOfARecordingFile,
} from './recordingFileEnds.js';

/** Where the recordings live inside DATA_DIR: `<dataFolder>/recordings/<sourceId>/`. */
export function buildRecordingsFolderPath(dataFolder: string): string {
  return join(dataFolder, 'recordings');
}

/**
 * Lists every recording in `<recordingsFolder>/<sourceId>/*.jsonl`, oldest first, as the
 * store holds them after a restart: every one closed, because a restart closes the
 * recordings and no source comes back recording (decision D13).
 * Only the two ends of each file are read, never the lines between, so a boot does not
 * slow down with every hour recorded (gate 2 on PR #16):
 * - snapshotCount and endedAtMs come from the last whole line: its snapshotNumber and
 *   its moment. A file written before lines carried their number has its lines counted
 *   instead (a streaming read of the whole file, for those old files only).
 * - startedAtMs is the moment in the file name (the same value the slice held before
 *   the restart); a file renamed by hand starts at its first line instead.
 * - sourceLabel is the source's current label, or its id when the source was deleted:
 *   the file does not hold the label, and the id still tells the operator whose it was.
 * A last line that is not a whole recorded line (cut off by a power cut or a full disk)
 * is skipped with a warning, and the line before it counts; a damaged line in between
 * is not looked at (the replay skips it). A file with no moment at all, in its name or
 * its lines, is skipped with a warning.
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

/** The message of an error, for the log. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads one recording file into its closed entry, or undefined when it cannot be read or
 * has no moment at all. Opens the file once and reads only its ends.
 */
function readOneRecordingFile(file: {
  recordingsFolder: string;
  sourceId: string;
  sourceLabel: string;
  fileName: string;
  logger: ServerLogger;
}): Recording | undefined {
  const recordingId = `${file.sourceId}/${file.fileName}`;
  const filePath = join(file.recordingsFolder, file.sourceId, file.fileName);
  let fileDescriptor: number;
  try {
    fileDescriptor = openSync(filePath, 'r');
  } catch (openError) {
    file.logger.warn(
      { recording_id: recordingId, error: describeError(openError) },
      'recording skipped: file unreadable',
    );
    return undefined;
  }
  try {
    return readOneOpenRecordingFile({ ...file, recordingId, fileDescriptor });
  } catch (readError) {
    file.logger.warn(
      { recording_id: recordingId, error: describeError(readError) },
      'recording skipped: file unreadable',
    );
    return undefined;
  } finally {
    closeSync(fileDescriptor);
  }
}

/** readOneRecordingFile once the file is open; a read that fails throws. */
function readOneOpenRecordingFile(file: {
  sourceId: string;
  sourceLabel: string;
  fileName: string;
  logger: ServerLogger;
  recordingId: string;
  fileDescriptor: number;
}): Recording | undefined {
  const fileSizeInBytes = fstatSync(file.fileDescriptor).size;
  const endOfTheFile = readTheEndOfARecordingFile(file.fileDescriptor, fileSizeInBytes);
  if (endOfTheFile.isLastLineCutOff) {
    file.logger.warn(
      { recording_id: file.recordingId },
      'recording last line skipped: not a whole recorded snapshot',
    );
  }
  const lastLine = endOfTheFile.lastLine;

  // The first line is read only for a file renamed by hand: the name holds the start.
  const startedAtMs =
    readStartMomentFromRecordingFileName(file.fileName) ??
    readTheFirstLineOfARecordingFile(file.fileDescriptor, fileSizeInBytes)?.atMs;
  if (startedAtMs === undefined) {
    file.logger.warn(
      { recording_id: file.recordingId },
      'recording skipped: no moment in its name and no good line',
    );
    return undefined;
  }

  let snapshotCount = 0;
  if (lastLine !== undefined) {
    snapshotCount =
      lastLine.snapshotNumber ?? countTheWholeLinesOfAFile(file.fileDescriptor, fileSizeInBytes);
  }
  return {
    id: file.recordingId,
    sourceId: file.sourceId,
    sourceLabel: file.sourceLabel,
    fileName: file.fileName,
    startedAtMs,
    // A recording with no line ends where it started: it holds no time at all.
    endedAtMs: lastLine?.atMs ?? startedAtMs,
    snapshotCount,
  };
}

/**
 * Orders recordings by start; recordings of one millisecond by the number in their file
 * name (1, 2, 10), the order they were started in, as the live list holds them. The
 * names' text would not do: '-' sorts before '.', and "-10" before "-2". A file renamed
 * by hand has no number and comes after the numbered ones of its millisecond; two such
 * files are ordered by id, as plain text, so the list reads the same at every boot.
 */
function compareRecordingsOldestFirst(first: Recording, second: Recording): number {
  if (first.startedAtMs !== second.startedAtMs) {
    return first.startedAtMs - second.startedAtMs;
  }
  const firstNumber =
    readRecordingNumberFromRecordingFileName(first.fileName) ?? Number.POSITIVE_INFINITY;
  const secondNumber =
    readRecordingNumberFromRecordingFileName(second.fileName) ?? Number.POSITIVE_INFINITY;
  if (firstNumber !== secondNumber) {
    return firstNumber < secondNumber ? -1 : 1;
  }
  if (first.id === second.id) {
    return 0;
  }
  return first.id < second.id ? -1 : 1;
}
