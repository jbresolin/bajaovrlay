// The adapter of kind `replay`: a recording played back as a live source.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { type DataShapeKey, type ReplayConfig, ReplayConfigSchema } from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import {
  parseRecordingLine,
  type RecordingLine,
  splitRecordingTextIntoLines,
} from '../../recordingLine.js';
import type { DataSourceAdapter } from '../dataSourceAdapter.js';
import {
  chooseRecordedLineToReplay,
  rewriteShapesOntoTheCurrentTimeline,
} from './replayTimeline.js';

/** What the replay adapter needs: where the recordings are (`<DATA_DIR>/recordings`). */
export type ReplayAdapterOptions = {
  recordingsFolder: string;
};

// Every shape a recording can hold; which ones a given recording holds is only known
// once its file is read, and listProducedShapes must answer at once.
const allDataShapeKeys: DataShapeKey[] = ['session', 'positions', 'standings', 'brackets'];

// How many recordings stay parsed in memory. A four-hour enduro at one line every two
// seconds is about 7 200 lines of 60 cars, hundreds of MB once parsed, so only the
// recordings in use are kept: two covers a rehearsal with two replays side by side.
// A third replay running at once makes them take turns reading their files (slower
// polls, still correct).
const mostRecordingsKeptInMemory = 2;

/**
 * Builds the replay adapter. Each poll answers the recorded line of the moment on the
 * replay's timeline, moved onto today's (replayTimeline.ts).
 *
 * Each recording is read once and kept in memory by its id, the two most recently
 * polled only (mostRecordingsKeptInMemory). That is safe because a replay may only name
 * a closed recording (the store refuses an open one with RECORDING_NOT_FOUND), and a
 * closed recording's file is never written again. A file that cannot be read is not
 * kept, so the next poll tries again. A line that is not a
 * recorded snapshot is skipped; a recording with no good line fails every poll.
 */
export function createReplayAdapter(
  options: ReplayAdapterOptions,
): DataSourceAdapter<ReplayConfig> {
  const linesByRecordingId = new Map<string, RecordingLine[]>();

  /** The lines of a recording, from memory or read from its file; throws a pt-BR Error. */
  async function readRecordingLines(recordingId: string): Promise<RecordingLine[]> {
    const linesInMemory = linesByRecordingId.get(recordingId);
    if (linesInMemory !== undefined) {
      // Put it back as the most recently used (a Map keeps the order keys were set in).
      linesByRecordingId.delete(recordingId);
      linesByRecordingId.set(recordingId, linesInMemory);
      return linesInMemory;
    }
    // The id is `<sourceId>/<fileName>` from the recordings slice (the store checked the
    // replay names one), so it is a path inside the recordings folder.
    const fileText = await readRecordingFileText(
      join(options.recordingsFolder, recordingId),
      recordingId,
    );
    const lines = splitRecordingTextIntoLines(fileText)
      .map(parseRecordingLine)
      .filter((line) => line !== undefined)
      // Lines are written in poll order; sorted anyway so the timeline can rely on it.
      .sort((first, second) => first.atMs - second.atMs);
    if (lines.length === 0) {
      throw new Error(ptBR.dataSourceErrors.recordingHasNoData(recordingId));
    }
    linesByRecordingId.set(recordingId, lines);
    dropTheLeastRecentlyUsedRecordings();
    return lines;
  }

  /** Forgets the recordings polled least recently, beyond mostRecordingsKeptInMemory. */
  function dropTheLeastRecentlyUsedRecordings(): void {
    while (linesByRecordingId.size > mostRecordingsKeptInMemory) {
      const leastRecentlyUsedId = linesByRecordingId.keys().next().value;
      if (leastRecentlyUsedId === undefined) {
        return;
      }
      linesByRecordingId.delete(leastRecentlyUsedId);
    }
  }

  return {
    kind: 'replay',
    configSchema: ReplayConfigSchema,
    listProducedShapes: () => [...allDataShapeKeys],
    // The signal is not watched: reading one local file takes far less than the shortest
    // timeout (500 ms), and every later poll answers from memory.
    pollOnce: async (config, context) => {
      const lines = await readRecordingLines(config.recordingId);
      const nowMs = context.readCurrentTime().getTime();
      const replayed = chooseRecordedLineToReplay(lines, config, nowMs);
      const shapes = rewriteShapesOntoTheCurrentTimeline(replayed.line.shapes, {
        targetAtMs: replayed.targetAtMs,
        nowMs,
        isHeldAtTheEnd: replayed.isHeldAtTheEnd,
      });
      return { shapes };
    },
  };
}

/** Reads a recording file, turning a failure into a pt-BR Error the operator reads. */
async function readRecordingFileText(filePath: string, recordingId: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (readError) {
    const isFileMissing =
      readError instanceof Error && 'code' in readError && readError.code === 'ENOENT';
    if (isFileMissing) {
      throw new Error(ptBR.dataSourceErrors.recordingFileNotFound(recordingId), {
        cause: readError,
      });
    }
    throw new Error(ptBR.dataSourceErrors.recordingFileUnreadable(recordingId), {
      cause: readError,
    });
  }
}
