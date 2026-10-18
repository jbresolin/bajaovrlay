// The adapter of kind `replay`: a recording played back as a live source.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { type DataShapeKey, type ReplayConfig, ReplayConfigSchema } from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import { validatePolledShapes } from '../../polledShapesValidation.js';
import { parseRecordedLine, type RecordedLine } from '../../recordingLine.js';
import { type DataSourceAdapter, StillPreparingForPollingError } from '../dataSourceAdapter.js';
import {
  chooseRecordedLineToReplay,
  rewriteShapesOntoTheCurrentTimeline,
} from './replayTimeline.js';

/** A recording read from its file: its lines, and its file size for the memory bound. */
export type LoadedRecording = { lines: RecordedLine[]; fileSizeInBytes: number };

/**
 * Reads one recording file into its lines, or rejects with a pt-BR Error. The server
 * reads the file as a stream (readRecordedLinesFromFile); tests pass one whose reads they
 * end by hand, to check what a poll does while a read is still going.
 */
export type ReadRecordingFile = (filePath: string, recordingId: string) => Promise<LoadedRecording>;

/** What the replay adapter needs. */
export type ReplayAdapterOptions = {
  /** Where the recordings are: `<DATA_DIR>/recordings`. */
  recordingsFolder: string;
  /** Tests make it small; largestTotalBytesKeptInMemoryByDefault otherwise. */
  largestTotalBytesKeptInMemory?: number | undefined;
  /** Tests replace it; readRecordedLinesFromFile otherwise. */
  readRecordingFile?: ReadRecordingFile | undefined;
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

/**
 * Builds the replay adapter. Each poll answers the recorded line of the moment on the
 * replay's timeline, moved onto today's (replayTimeline.ts).
 *
 * Reading a recording happens beside the polls, not inside one (gate 2 re-check on PR
 * #16): prepareForPolling (the source turned on, or its config edited) starts reading
 * it, and a poll that finds the read still going waits for it only until its signal
 * fires, then rejects with "Carregando a gravação…" while the read carries on for the
 * next poll. A 4-hour recording takes about a second to read, so without this its first
 * poll would time out and the source read "Atrasada" for nothing. A poll that comes with
 * no prepare before it starts the read itself, the same way.
 *
 * Each recording is read and parsed once and kept in memory by its id, the most recently
 * polled first, up to largestTotalBytesKeptInMemory of file. That is safe because a
 * replay may only name a closed recording (the store refuses an open one with
 * RECORDING_NOT_FOUND), and a closed recording's file is never written again. There is
 * one read in flight per recording, shared by every prepare and poll that asks for it
 * meanwhile (two replays of the same recording read it once). A read that fails is
 * remembered by recording id: the poll waiting for it fails with its pt-BR reason, and
 * so does every later poll, at once and without reading the file again, until the next
 * prepare (the source turned off and on, or edited) clears it and reads again. Without
 * that, a large file that fails late (no usable line, a disk error mid-way) would be
 * read again at every poll, and the operator would only ever read "Carregando a
 * gravação…" from polls called off before the read failed, never its real reason.
 *
 * Loading only parses each line and checks its moment and that it has shapes; a line
 * that is not even that is skipped, and a recording with no such line fails every poll.
 * The one line a poll answers is then checked against the shapes, and a bad one fails
 * that poll with a pt-BR reason (the source goes stale; nothing crashes).
 */
export function createReplayAdapter(
  options: ReplayAdapterOptions,
): DataSourceAdapter<ReplayConfig> {
  const largestTotalBytesKeptInMemory =
    options.largestTotalBytesKeptInMemory ?? largestTotalBytesKeptInMemoryByDefault;
  const readRecordingFile = options.readRecordingFile ?? readRecordedLinesFromFile;
  // A Map keeps its keys in the order they were set: the least recently polled first.
  const loadedRecordingsById = new Map<string, LoadedRecording>();
  // The read of each recording still going, so a second ask joins it instead of reading
  // the file again.
  const readsInFlightById = new Map<string, Promise<RecordedLine[]>>();
  // The pt-BR Error of each recording whose last read failed, until a prepare clears it.
  const failedReadsById = new Map<string, Error>();

  /** The lines of a recording in memory, put back as the most recently used; or undefined. */
  function takeLinesFromMemory(recordingId: string): RecordedLine[] | undefined {
    const recordingInMemory = loadedRecordingsById.get(recordingId);
    if (recordingInMemory === undefined) {
      return undefined;
    }
    loadedRecordingsById.delete(recordingId);
    loadedRecordingsById.set(recordingId, recordingInMemory);
    return recordingInMemory.lines;
  }

  /**
   * The read of a recording that is not in memory: the one already going, or a new one.
   * Nothing waits on a read started here, so it is never called off by a poll's signal.
   */
  function startOrJoinTheRead(recordingId: string): Promise<RecordedLine[]> {
    const readInFlight = readsInFlightById.get(recordingId);
    if (readInFlight !== undefined) {
      return readInFlight;
    }
    const newRead = readRecordingIntoMemory(recordingId);
    readsInFlightById.set(recordingId, newRead);
    // Handling the failure here also keeps a read that fails with nobody waiting for it
    // from being an unhandled rejection, which would stop the server.
    const forgetTheReadThatEnded = () => {
      readsInFlightById.delete(recordingId);
    };
    const rememberTheReadThatFailed = (readError: unknown) => {
      readsInFlightById.delete(recordingId);
      failedReadsById.set(recordingId, asAnError(readError));
    };
    void newRead.then(forgetTheReadThatEnded, rememberTheReadThatFailed);
    return newRead;
  }

  /** Reads a recording's file and keeps its lines in memory; rejects with a pt-BR Error. */
  async function readRecordingIntoMemory(recordingId: string): Promise<RecordedLine[]> {
    // The id is `<sourceId>/<fileName>` from the recordings slice (the store checked the
    // replay names one), so it is a path inside the recordings folder.
    const loadedRecording = await readRecordingFile(
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
   * The lines a poll answers from: at once from memory, or from the read once it ends.
   * If the poll's signal fires first, rejects at once with "Carregando a gravação…"
   * (StillPreparingForPollingError, which the poller records instead of "Tempo
   * esgotado"), and the read carries on. A remembered failed read rejects at once with
   * its own reason, and no new read starts.
   */
  function readLinesForAPoll(recordingId: string, signal: AbortSignal): Promise<RecordedLine[]> {
    const linesInMemory = takeLinesFromMemory(recordingId);
    if (linesInMemory !== undefined) {
      return Promise.resolve(linesInMemory);
    }
    const failedReadError = failedReadsById.get(recordingId);
    if (failedReadError !== undefined) {
      return Promise.reject(failedReadError);
    }
    const readInFlight = startOrJoinTheRead(recordingId);
    return waitForTheReadUnlessCalledOff(readInFlight, signal);
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
    // Starts the read and returns at once; its failure is answered by the polls. A
    // failure remembered from an earlier read is cleared first, so preparing retries it.
    prepareForPolling: (config) => {
      failedReadsById.delete(config.recordingId);
      if (!loadedRecordingsById.has(config.recordingId)) {
        startOrJoinTheRead(config.recordingId);
      }
    },
    pollOnce: async (config, context) => {
      const lines = await readLinesForAPoll(config.recordingId, context.signal);
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

/**
 * Waits for a read until the poll's signal fires, whichever comes first. A signal that
 * had already fired rejects at once. The read itself is never stopped: the next poll
 * answers from it.
 */
function waitForTheReadUnlessCalledOff(
  readInFlight: Promise<RecordedLine[]>,
  signal: AbortSignal,
): Promise<RecordedLine[]> {
  return new Promise((resolve, reject) => {
    const rejectAsStillLoading = () => {
      reject(new StillPreparingForPollingError(ptBR.dataSourceErrors.recordingStillLoading));
    };
    if (signal.aborted) {
      rejectAsStillLoading();
      return;
    }
    signal.addEventListener('abort', rejectAsStillLoading, { once: true });
    readInFlight.then(
      (lines) => {
        signal.removeEventListener('abort', rejectAsStillLoading);
        resolve(lines);
      },
      (readError: unknown) => {
        signal.removeEventListener('abort', rejectAsStillLoading);
        reject(asAnError(readError));
      },
    );
  });
}

/** A thrown value as an Error; the reads only throw Errors, but a promise may hold anything. */
function asAnError(thrownValue: unknown): Error {
  return thrownValue instanceof Error ? thrownValue : new Error(String(thrownValue));
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
