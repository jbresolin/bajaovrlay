import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { DataSnapshot, Recording, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { ptBR } from '../../core/messages/ptBR.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { applyCommandAsTheRecorder } from './recorderCommands.js';
import {
  bytesPerMegabyte,
  createDurationCapWatcher,
  millisecondsPerHour,
  type RecordingCaps,
  recordingCapsByDefault,
} from './recordingCaps.js';
import { buildRecordingLineText } from './recordingLine.js';

/** Appends one line of text to a file, making its folder first; throws when it cannot. */
export type AppendLineToFile = (filePath: string, lineText: string) => void;

/** What the recorder needs; the timers, the file writing and the caps have defaults. */
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
  /** Tests make them small; recordingCapsByDefault otherwise. */
  recordingCaps?: RecordingCaps | undefined;
};

/** The running recorder; stop() stops watching the store and calls off every wait. */
export type DataSourceRecorder = { stop: () => void };

/**
 * Writes the recordings to disk (decision D10). The store decides when a recording opens
 * (startRecording) and closes (stop, turning the source off, deleting it); the recorder
 * appends `{"atMs":…,"snapshotNumber":…,"shapes":…}` as one line to
 * `<recordingsFolder>/<sourceId>/<fileName>` of the open recording:
 * - when a recording opens on a source that already has data, that data, at the moment
 *   "Gravar" was pressed: the replay then starts from what was on screen at that moment,
 *   and data that does not change (standings between heats) is still recorded;
 * - each time a recording source gets a new snapshot. A poll that repeated the data
 *   keeps the same snapshot object, so it writes nothing.
 * A poll is dated when it started, so one that started just before "Gravar" and answered
 * after it is written at the recording's start, never before it: a recording cannot end
 * before it began.
 *
 * Once a line is in the file, the recorder reports the number of lines written with
 * recordRecordingProgress, so the list never counts a snapshot the disk does not hold
 * (gate 2 on PR #16). The recorder signs its commands `sistema:gravador` and sends them
 * from a 0 ms timer, never inside the store's listener: the store is still telling its
 * listeners about the poll, and a command sent from inside would reach the other
 * listeners before the poll itself.
 *
 * "Closing the file" is simply not appending any more: no file handle is kept open, and
 * each line is one appendFileSync (it opens, writes and closes). Trade-off: one open and
 * close per poll (every two seconds per recording source, cheap) in exchange for nothing
 * to close or leak when a recording stops, a source is deleted or the server dies. A
 * file ends on a whole line, except when a write fails part-way (a full disk) or the
 * machine loses power mid-write: the boot listing and the replay skip such a cut-off
 * last line, and a failed write stops the recording at once.
 *
 * A recording stops itself, with a pt-BR reason on the source, when a write fails
 * (logged as an error, decision D9), when its next line would pass the size cap (that
 * line is not written), or at its duration cap (recordingCaps.ts). The source keeps
 * polling (D9). Until the stop lands, the recording is not written to again.
 */
export function startDataSourceRecorder(options: DataSourceRecorderOptions): DataSourceRecorder {
  const { stateStore, logger, recordingsFolder } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  const appendLine = options.appendLine ?? appendLineToFileMakingItsFolder;
  const recordingCaps = options.recordingCaps ?? recordingCapsByDefault;
  // Each source's snapshot object as last seen. The store builds a new object for every
  // accepted poll and keeps the very same one otherwise, so "a different object" is
  // exactly "a new snapshot", even when two polls share a moment.
  const lastSeenSnapshotBySourceId = new Map<string, DataSnapshot>();
  // The recordings that were open when the store last changed, to notice one opening.
  const openRecordingIdsLastSeen = new Set<string>();
  // What is in each recording's file so far: whole lines, and their bytes.
  const writtenLineCountByRecordingId = new Map<string, number>();
  const writtenBytesByRecordingId = new Map<string, number>();
  // Recordings whose stop is on its way (a failed write, a cap): no more lines.
  const recordingIdsBeingStopped = new Set<string>();
  // Recordings with lines written since the last progress report.
  const recordingIdsWithProgressToReport = new Set<string>();
  let isProgressReportPending = false;
  // The 0 ms timers still to run.
  const pendingDeferredTimerHandles = new Set<unknown>();
  const durationCapWatcher = createDurationCapWatcher({
    longestDurationMs: recordingCaps.longestDurationMs,
    startTimer,
    cancelTimer,
    onDurationCapReached: stopTheRecordingAtItsDurationCap,
  });

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

  /**
   * For each recording that has just opened: starts its duration cap's wait, and writes
   * the data its source already had as its first line.
   */
  function startEachNewlyOpenedRecording(slices: Slices): void {
    for (const recording of slices.recordings) {
      const isNewlyOpened =
        recording.endedAtMs === null && !openRecordingIdsLastSeen.has(recording.id);
      if (!isNewlyOpened) {
        continue;
      }
      // The wait starts when the recorder sees the recording open, the moment "Gravar"
      // was applied. A restart closes every recording (D13), so none is open at start-up.
      durationCapWatcher.startWaitingFor(recording);
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

  /**
   * Appends one line to a recording's file and reports it written. A line that would
   * pass the size cap is not written, and a write that fails is logged; either way the
   * recording stops.
   */
  function appendSnapshotToRecording(
    recording: Recording,
    lineMomentMs: number,
    snapshot: DataSnapshot,
  ): void {
    if (recordingIdsBeingStopped.has(recording.id)) {
      return;
    }
    const snapshotNumber = (writtenLineCountByRecordingId.get(recording.id) ?? 0) + 1;
    const lineText = buildRecordingLineText({
      atMs: lineMomentMs,
      snapshotNumber,
      shapes: snapshot.shapes,
    });
    const fileSizeAfterTheLine =
      (writtenBytesByRecordingId.get(recording.id) ?? 0) + Buffer.byteLength(lineText, 'utf8');
    if (fileSizeAfterTheLine > recordingCaps.largestFileSizeInBytes) {
      logger.info(
        { source_id: recording.sourceId, recording_id: recording.id },
        'recording stopped: size cap reached',
      );
      const capInMegabytes = recordingCaps.largestFileSizeInBytes / bytesPerMegabyte;
      stopTheRecordingSoon(
        recording,
        ptBR.dataSourceErrors.recordingSizeCapReached(capInMegabytes),
      );
      return;
    }
    // The source id comes from the server (a UUID or the seeded id), never from a
    // person, so it is safe as a folder name.
    const filePath = join(recordingsFolder, recording.sourceId, recording.fileName);
    try {
      appendLine(filePath, lineText);
    } catch (writeError) {
      logger.error(
        {
          source_id: recording.sourceId,
          recording_id: recording.id,
          error: writeError instanceof Error ? writeError.message : String(writeError),
        },
        'recording write failed',
      );
      stopTheRecordingSoon(recording, ptBR.dataSourceErrors.recordingWriteFailed);
      return;
    }
    writtenLineCountByRecordingId.set(recording.id, snapshotNumber);
    writtenBytesByRecordingId.set(recording.id, fileSizeAfterTheLine);
    reportTheProgressOfRecordingSoon(recording.id);
  }

  /** Stops a recording whose duration cap's wait has ended, if it is still open. */
  function stopTheRecordingAtItsDurationCap(recording: Recording): void {
    if (!isRecordingStillOpen(recording.id)) {
      return;
    }
    logger.info(
      { source_id: recording.sourceId, recording_id: recording.id },
      'recording stopped: duration cap reached',
    );
    recordingIdsBeingStopped.add(recording.id);
    const capInHours = recordingCaps.longestDurationMs / millisecondsPerHour;
    sendTheStopOfRecording(
      recording.sourceId,
      ptBR.dataSourceErrors.recordingDurationCapReached(capInHours),
    );
  }

  /**
   * Marks a recording as being stopped and sends its stop from a 0 ms timer. The stop
   * names only the source, so it is sent only while this very recording is still the
   * open one: an operator who pressed "Parar gravação" and "Gravar" before the timer ran
   * has a new recording, which this stop must not close.
   */
  function stopTheRecordingSoon(recording: Recording, failureMessage: string): void {
    recordingIdsBeingStopped.add(recording.id);
    startDeferredTimer(() => {
      if (isRecordingStillOpen(recording.id)) {
        sendTheStopOfRecording(recording.sourceId, failureMessage);
      }
    });
  }

  /** Whether the store still lists this recording as open. */
  function isRecordingStillOpen(recordingId: string): boolean {
    return stateStore
      .readAllSlices()
      .recordings.some((candidate) => candidate.id === recordingId && candidate.endedAtMs === null);
  }

  /** Notes that a recording has new lines, and sends the progress reports from a 0 ms timer. */
  function reportTheProgressOfRecordingSoon(recordingId: string): void {
    recordingIdsWithProgressToReport.add(recordingId);
    if (isProgressReportPending) {
      return;
    }
    isProgressReportPending = true;
    startDeferredTimer(() => {
      isProgressReportPending = false;
      const recordingIdsToReport = [...recordingIdsWithProgressToReport];
      recordingIdsWithProgressToReport.clear();
      for (const recordingIdToReport of recordingIdsToReport) {
        sendTheProgressOfRecording(recordingIdToReport);
      }
    });
  }

  /** Sends recordRecordingProgress with the number of lines now in a recording's file. */
  function sendTheProgressOfRecording(recordingId: string): void {
    const snapshotCount = writtenLineCountByRecordingId.get(recordingId) ?? 0;
    applyCommandAsTheRecorder(
      stateStore,
      logger,
      { type: 'recordRecordingProgress', recordingId, snapshotCount },
      { recording_id: recordingId },
    );
  }

  /** Sends the recorder's stopRecording of a source, with the pt-BR reason. */
  function sendTheStopOfRecording(sourceId: string, failureMessage: string): void {
    applyCommandAsTheRecorder(
      stateStore,
      logger,
      { type: 'stopRecording', sourceId, failureMessage },
      { source_id: sourceId },
    );
  }

  /** Starts a 0 ms timer that stop() can call off. */
  function startDeferredTimer(onTimeIsUp: () => void): void {
    const timerHandle = startTimer(() => {
      pendingDeferredTimerHandles.delete(timerHandle);
      onTimeIsUp();
    }, 0);
    pendingDeferredTimerHandles.add(timerHandle);
  }

  rememberTheSlices(stateStore.readAllSlices());
  const unsubscribe = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    const isAboutRecordings =
      changedSliceNames.includes('dataSnapshots') || changedSliceNames.includes('recordings');
    if (!isAboutRecordings) {
      return;
    }
    startEachNewlyOpenedRecording(slices);
    writeNewSnapshotsOfRecordingSources(slices);
    durationCapWatcher.callOffTheWaitsOfClosedRecordings(slices);
    rememberTheSlices(slices);
  });

  return {
    stop: () => {
      unsubscribe();
      for (const timerHandle of pendingDeferredTimerHandles) {
        cancelTimer(timerHandle);
      }
      pendingDeferredTimerHandles.clear();
      durationCapWatcher.callOffEveryWait();
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
