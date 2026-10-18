import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { DataSnapshot, Recording, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { ptBR } from '../../core/messages/ptBR.js';
import { dataSourceRecorderActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { buildRecordingLineText } from './recordingLine.js';

/** Appends one line of text to a file, making its folder first; throws when it cannot. */
export type AppendLineToFile = (filePath: string, lineText: string) => void;

/** What the recorder needs; the timers and the file writing default to Node's own. */
export type DataSourceRecorderOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** `<DATA_DIR>/recordings`: each recording is `<sourceId>/<fileName>` under it. */
  recordingsFolder: string;
  /** Starts a wait and returns something cancelTimer can cancel it with. */
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  /** Cancels a wait started by startTimer. */
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
  /** Writes a line; tests replace it with one that fails like a full disk. */
  appendLine?: AppendLineToFile | undefined;
};

/** The running recorder; stop() stops watching the store and calls off a pending stop. */
export type DataSourceRecorder = { stop: () => void };

/**
 * Mirrors the recordings to disk (decision D10). The store decides everything: when a
 * recording opens (startRecording), counts a snapshot (an accepted poll, or the snapshot
 * already there when "Gravar" was pressed) and closes (stop, turning the source off,
 * deleting it). The recorder appends `{"atMs":…,"shapes":…}` as one line to
 * `<recordingsFolder>/<sourceId>/<fileName>` of the open recording:
 * - when a recording opens on a source that already has data, that data, at the moment
 *   "Gravar" was pressed: the replay then starts from what was on screen at that moment,
 *   and data that does not change (standings between heats) is still recorded;
 * - each time a recording source gets a new snapshot. A poll that repeated the data
 *   keeps the same snapshot object, so it writes nothing, exactly as the store counts
 *   nothing.
 * A poll is dated when it started, so one that started just before "Gravar" and answered
 * after it is written at the recording's start, never before it: a recording cannot end
 * before it began.
 *
 * "Closing the file" is simply not appending any more: no file handle is kept open, and
 * each line is one appendFileSync (it opens, writes and closes). Trade-off: one open and
 * close per poll (every two seconds per recording source, cheap) in exchange for nothing
 * to close or leak when a recording stops, a source is deleted or the server dies, and
 * a file that always ends on a whole line.
 *
 * A write that fails (disk full, no permission) is logged as an error, and the recorder
 * then sends stopRecording with a pt-BR reason, signed `sistema:gravador`, from a 0 ms
 * timer, never inside the store's listener. The source keeps polling (D9). Until that
 * stop lands, the failed recording is not written to again.
 */
export function startDataSourceRecorder(options: DataSourceRecorderOptions): DataSourceRecorder {
  const { stateStore, logger, recordingsFolder } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  const appendLine = options.appendLine ?? appendLineToFileMakingItsFolder;
  // Each source's snapshot object as last seen. The store builds a new object for every
  // accepted poll and keeps the very same one otherwise, so "a different object" is
  // exactly "a snapshot the store counted", even when two polls share a moment.
  const lastSeenSnapshotBySourceId = new Map<string, DataSnapshot>();
  // The recordings that were open when the store last changed, to notice one opening.
  const openRecordingIdsLastSeen = new Set<string>();
  // Recordings whose write failed: their stop is on its way, so they get no more tries.
  const recordingIdsThatFailedToWrite = new Set<string>();
  const pendingStopTimerHandles = new Set<unknown>();

  /** Remembers the snapshots and the open recordings as they are now, writing nothing. */
  function rememberTheSlices(slices: Slices): void {
    lastSeenSnapshotBySourceId.clear();
    for (const snapshot of slices.dataSnapshots) {
      lastSeenSnapshotBySourceId.set(snapshot.sourceId, snapshot);
    }
    openRecordingIdsLastSeen.clear();
    for (const recording of slices.recordings) {
      if (recording.endedAtMs === null) {
        openRecordingIdsLastSeen.add(recording.id);
      }
    }
  }

  /** Writes the data a source already had into each recording that has just opened. */
  function writeTheCurrentSnapshotIntoNewlyOpenedRecordings(slices: Slices): void {
    for (const recording of slices.recordings) {
      const isNewlyOpened =
        recording.endedAtMs === null && !openRecordingIdsLastSeen.has(recording.id);
      if (!isNewlyOpened) {
        continue;
      }
      const currentSnapshot = slices.dataSnapshots.find(
        (snapshot) => snapshot.sourceId === recording.sourceId,
      );
      if (currentSnapshot !== undefined) {
        appendSnapshotToRecording(recording, recording.startedAtMs, currentSnapshot);
      }
    }
  }

  /** Writes each new snapshot of a recording source to its open recording. */
  function writeNewSnapshotsOfRecordingSources(slices: Slices): void {
    for (const snapshot of slices.dataSnapshots) {
      const isNewSnapshot = lastSeenSnapshotBySourceId.get(snapshot.sourceId) !== snapshot;
      if (isNewSnapshot) {
        writeSnapshotIfItsSourceRecords(slices, snapshot);
      }
    }
  }

  /** Appends a snapshot to its source's open recording, if the source is recording. */
  function writeSnapshotIfItsSourceRecords(slices: Slices, snapshot: DataSnapshot): void {
    const source = slices.dataSources.find((candidate) => candidate.id === snapshot.sourceId);
    const openRecording = slices.recordings.find(
      (recording) => recording.sourceId === snapshot.sourceId && recording.endedAtMs === null,
    );
    if (source?.isRecording !== true || openRecording === undefined) {
      return;
    }
    // A poll that started before "Gravar" is dated before the recording began.
    const lineMomentMs = Math.max(snapshot.receivedAtMs, openRecording.startedAtMs);
    appendSnapshotToRecording(openRecording, lineMomentMs, snapshot);
  }

  /** Appends one line to a recording's file; a failure stops the recording (D9). */
  function appendSnapshotToRecording(
    recording: Recording,
    lineMomentMs: number,
    snapshot: DataSnapshot,
  ): void {
    if (recordingIdsThatFailedToWrite.has(recording.id)) {
      return;
    }
    // The source id comes from the server (a UUID or the seeded id), never from a
    // person, so it is safe as a folder name.
    const filePath = join(recordingsFolder, recording.sourceId, recording.fileName);
    try {
      appendLine(filePath, buildRecordingLineText(lineMomentMs, snapshot.shapes));
    } catch (writeError) {
      recordingIdsThatFailedToWrite.add(recording.id);
      logger.error(
        {
          source_id: recording.sourceId,
          recording_id: recording.id,
          error: writeError instanceof Error ? writeError.message : String(writeError),
        },
        'recording write failed',
      );
      sendTheStopOfAFailedRecordingSoon(recording.sourceId);
    }
  }

  /**
   * Stops a recording whose write failed, from a 0 ms timer: the store is still telling
   * its listeners about the poll, and a command sent from inside would reach the other
   * listeners before the poll itself.
   */
  function sendTheStopOfAFailedRecordingSoon(sourceId: string): void {
    const timerHandle = startTimer(() => {
      pendingStopTimerHandles.delete(timerHandle);
      try {
        stateStore.applyCommand(
          {
            type: 'stopRecording',
            sourceId,
            failureMessage: ptBR.dataSourceErrors.recordingWriteFailed,
          },
          dataSourceRecorderActor,
        );
      } catch (commandError) {
        // applyCommand throws when the database cannot be written; the server's log is
        // the only place left to say so.
        logger.error(
          {
            source_id: sourceId,
            error: commandError instanceof Error ? commandError.message : String(commandError),
          },
          'recording stop after a failed write could not be applied',
        );
      }
    }, 0);
    pendingStopTimerHandles.add(timerHandle);
  }

  rememberTheSlices(stateStore.readAllSlices());
  const unsubscribe = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    const isAboutRecordings =
      changedSliceNames.includes('dataSnapshots') || changedSliceNames.includes('recordings');
    if (!isAboutRecordings) {
      return;
    }
    writeTheCurrentSnapshotIntoNewlyOpenedRecordings(slices);
    writeNewSnapshotsOfRecordingSources(slices);
    rememberTheSlices(slices);
  });

  return {
    stop: () => {
      unsubscribe();
      for (const timerHandle of pendingStopTimerHandles) {
        cancelTimer(timerHandle);
      }
      pendingStopTimerHandles.clear();
    },
  };
}

/** The default appendLine: makes the source's folder if needed, then appends the line. */
function appendLineToFileMakingItsFolder(filePath: string, lineText: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, lineText, 'utf8');
}

/** The default startTimer: Node's setTimeout. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** The default cancelTimer: Node's clearTimeout, for a handle startNodeTimer returned. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as NodeJS.Timeout | undefined);
}
