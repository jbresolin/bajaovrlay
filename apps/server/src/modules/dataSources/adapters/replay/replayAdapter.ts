// The adapter of kind `replay`: a recording played back as a live source.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { type DataShapeKey, type ReplayConfig, ReplayConfigSchema } from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import { validatePolledShapes } from '../../polledShapesValidation.js';
import { parseRecordedLine, type RecordedLine } from '../../recordingLine.js';
import type { DataSourceAdapter } from '../dataSourceAdapter.js';
import {
  chooseRecordedLineToReplay,
  rewriteShapesOntoTheCurrentTimeline,
} from './replayTimeline.js';

/** What the replay adapter needs. */
export type ReplayAdapterOptions = {
  /** Where the recordings are: `<DATA_DIR>/recordings`. */
  recordingsFolder: string;
  /** Tests make it small; largestTotalBytesKeptInMemoryByDefault otherwise. */
  largestTotalBytesKeptInMemory?: number | undefined;
};

// Every shape a recording can hold; which ones a given recording holds is only known
// once its file is read, and listProducedShapes must answer at once.
const allDataShapeKeys: DataShapeKey[] = ['session', 'positions', 'standings', 'brackets'];

// How much recording, counted in bytes of file, stays parsed in memory: 300 MB, the
// size cap of one recording (recorder.ts), so the largest recording always fits. Parsed,
// a recording takes about 1.3 times its file size (measured on the simulator's 60 cars),
// so about 400 MB of memory at most. A 4-hour enduro at one line every two seconds is
// about 180 MB of file, so one fits with room to spare and two side by side take turns
// reading their files (slower polls, still correct). The most recently polled recording
// is always kept, even alone above the bound.
const largestTotalBytesKeptInMemoryByDefault = 300 * 1_000_000;

/** A recording read from its file: its lines, and its file size for the memory bound. */
type LoadedRecording = { lines: RecordedLine[]; fileSizeInBytes: number };

/**
 * Builds the replay adapter. Each poll answers the recorded line of the moment on the
 * replay's timeline, moved onto today's (replayTimeline.ts).
 *
 * Each recording is read and parsed once and kept in memory by its id, the most recently
 * polled first, up to largestTotalBytesKeptInMemory of file. That is safe because a
 * replay may only name a closed recording (the store refuses an open one with
 * RECORDING_NOT_FOUND), and a closed recording's file is never written again. A file
 * that cannot be read is not kept, so the next poll tries again.
 *
 * Loading only parses each line and checks its moment and that it has shapes; a line
 * that is not even that is skipped, and a recording with no such line fails every poll.
 * The one line a poll answers is then checked against the shapes, and a bad one fails
 * that poll with a pt-BR reason (the source goes stale; nothing crashes).
 * What could go wrong: two replays of the same recording turned on at the same moment
 * both read it, as neither finds it in memory yet; the second simply replaces the first.
 */
export function createReplayAdapter(
  options: ReplayAdapterOptions,
): DataSourceAdapter<ReplayConfig> {
  const largestTotalBytesKeptInMemory =
    options.largestTotalBytesKeptInMemory ?? largestTotalBytesKeptInMemoryByDefault;
  // A Map keeps its keys in the order they were set: the least recently polled first.
  const loadedRecordingsById = new Map<string, LoadedRecording>();

  /** The lines of a recording, from memory or read from its file; throws a pt-BR Error. */
  async function readRecordingLines(recordingId: string): Promise<RecordedLine[]> {
    const recordingInMemory = loadedRecordingsById.get(recordingId);
    if (recordingInMemory !== undefined) {
      // Put it back as the most recently used.
      loadedRecordingsById.delete(recordingId);
      loadedRecordingsById.set(recordingId, recordingInMemory);
      return recordingInMemory.lines;
    }
    // The id is `<sourceId>/<fileName>` from the recordings slice (the store checked the
    // replay names one), so it is a path inside the recordings folder.
    const loadedRecording = await readRecordedLinesFromFile(
      join(options.recordingsFolder, recordingId),
      recordingId,
    );
    const lines = loadedRecording.lines;
    // Lines are written in poll order; sorted anyway so the timeline can rely on it.
    lines.sort((first, second) => first.atMs - second.atMs);
    if (lines.length === 0) {
      throw new Error(ptBR.dataSourceErrors.recordingHasNoData(recordingId));
    }
    loadedRecordingsById.set(recordingId, loadedRecording);
    dropTheLeastRecentlyUsedRecordingsBeyondTheBound();
    return lines;
  }

  /**
   * Forgets the recordings polled least recently while the total is above the bound,
   * always keeping the most recently polled one.
   */
  function dropTheLeastRecentlyUsedRecordingsBeyondTheBound(): void {
    while (
      loadedRecordingsById.size > 1 &&
      sumFileSizesInBytes(loadedRecordingsById) > largestTotalBytesKeptInMemory
    ) {
      const leastRecentlyUsedId = loadedRecordingsById.keys().next().value;
      if (leastRecentlyUsedId === undefined) {
        return;
      }
      loadedRecordingsById.delete(leastRecentlyUsedId);
    }
  }

  return {
    kind: 'replay',
    configSchema: ReplayConfigSchema,
    listProducedShapes: () => [...allDataShapeKeys],
    // The signal is not watched, on purpose: loading a large recording can take longer
    // than the poll's timeout (about a second for a 4-hour enduro). That first poll then
    // fails as "Tempo esgotado", but the loading goes on into memory, so the next poll
    // answers at once. Calling the load off would make such a recording never play.
    pollOnce: async (config, context) => {
      const lines = await readRecordingLines(config.recordingId);
      const nowMs = context.readCurrentTime().getTime();
      const replayed = chooseRecordedLineToReplay(lines, config, nowMs);
      // Only the answered line is checked here, so a bad one fails this poll with a
      // sentence naming the recording; the framework checks the rewritten shapes again.
      const shapesValidation = validatePolledShapes(replayed.line.shapes);
      if (!shapesValidation.isValid) {
        throw new Error(
          ptBR.dataSourceErrors.recordedLineInvalid(
            config.recordingId,
            shapesValidation.errorMessage,
          ),
        );
      }
      const shapes = rewriteShapesOntoTheCurrentTimeline(shapesValidation.shapes, {
        targetAtMs: replayed.targetAtMs,
        nowMs,
        isHeldAtTheEnd: replayed.isHeldAtTheEnd,
      });
      return { shapes };
    },
  };
}

/** The total file size of the recordings in memory. */
function sumFileSizesInBytes(loadedRecordingsById: Map<string, LoadedRecording>): number {
  let totalBytes = 0;
  for (const loadedRecording of loadedRecordingsById.values()) {
    totalBytes += loadedRecording.fileSizeInBytes;
  }
  return totalBytes;
}

/**
 * Reads a recording file line by line as a stream, parsing each line lightly
 * (parseRecordedLine) and skipping the ones that are not recorded lines. The stream
 * hands over the file a chunk at a time, so the server's event loop turns between
 * chunks and the rest of the server (other polls, WebSocket messages) keeps running
 * while a large recording loads (gate 2 on PR #16). A failure becomes a pt-BR Error the
 * operator reads.
 */
async function readRecordedLinesFromFile(
  filePath: string,
  recordingId: string,
): Promise<LoadedRecording> {
  const fileSizeInBytes = await readFileSizeInBytes(filePath, recordingId);
  const lines: RecordedLine[] = [];
  try {
    const lineTexts = createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    for await (const lineText of lineTexts) {
      const line = parseRecordedLine(lineText);
      if (line !== undefined) {
        lines.push(line);
      }
    }
  } catch (readError) {
    throw new Error(ptBR.dataSourceErrors.recordingFileUnreadable(recordingId), {
      cause: readError,
    });
  }
  return { lines, fileSizeInBytes };
}

/** The size of a recording file, turning a failure into a pt-BR Error the operator reads. */
async function readFileSizeInBytes(filePath: string, recordingId: string): Promise<number> {
  try {
    const fileStatus = await stat(filePath);
    return fileStatus.size;
  } catch (statError) {
    const isFileMissing =
      statError instanceof Error && 'code' in statError && statError.code === 'ENOENT';
    if (isFileMissing) {
      throw new Error(ptBR.dataSourceErrors.recordingFileNotFound(recordingId), {
        cause: statError,
      });
    }
    throw new Error(ptBR.dataSourceErrors.recordingFileUnreadable(recordingId), {
      cause: statError,
    });
  }
}
