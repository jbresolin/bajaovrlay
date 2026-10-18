// The two caps of a recording (gate 2 on PR #16), and the waits that stop a recording
// at its longest duration. The recorder checks the size cap itself, line by line, and
// uses the duration-cap watcher below for the waits.
import type { Recording, Slices } from '@bajaovrlay/shared';

/** The two caps of a recording; whichever is reached first stops it. */
export type RecordingCaps = {
  /** How long a recording may run, from "Gravar". */
  longestDurationMs: number;
  /** How large its file may grow; a line that would pass this is not written. */
  largestFileSizeInBytes: number;
};

/** A megabyte as the operator reads it in the cap's message: a million bytes. */
export const bytesPerMegabyte = 1_000_000;

/** An hour, to say the duration cap in hours in the operator's message. */
export const millisecondsPerHour = 60 * 60 * 1_000;

/**
 * The caps of every recording: 6 hours, longer than any day's session (a 4-hour enduro
 * with its build-up), so only a recording forgotten overnight reaches it; 300 MB, a
 * 4-hour enduro of 60 cars polled every two seconds being about 180 MB, so only a faster
 * poll or a forgotten recording reaches it. Either way the disk of the machine that runs
 * the show is never filled by a recording.
 */
export const recordingCapsByDefault: RecordingCaps = {
  longestDurationMs: 6 * millisecondsPerHour,
  largestFileSizeInBytes: 300 * bytesPerMegabyte,
};

/** What the duration-cap watcher needs: the recorder's timers and what to do at the cap. */
export type DurationCapWatcherOptions = {
  longestDurationMs: number;
  startTimer: (onTimeIsUp: () => void, delayInMilliseconds: number) => unknown;
  cancelTimer: (timerHandle: unknown) => void;
  /** Called when a recording's wait ends; it may have closed meanwhile, so check it. */
  onDurationCapReached: (recording: Recording) => void;
};

/** One wait per open recording, started when it opens and called off when it closes. */
export type DurationCapWatcher = {
  startWaitingFor: (recording: Recording) => void;
  callOffTheWaitsOfClosedRecordings: (slices: Slices) => void;
  callOffEveryWait: () => void;
};

/**
 * Watches the duration cap of every open recording: a wait of longestDurationMs per
 * recording. A recording closed before its wait ends has the wait called off, so a
 * leftover wait can never stop the source's next recording.
 */
export function createDurationCapWatcher(options: DurationCapWatcherOptions): DurationCapWatcher {
  const timerHandleByRecordingId = new Map<string, unknown>();

  /** Starts the wait of a recording that has just opened. */
  function startWaitingFor(recording: Recording): void {
    const timerHandle = options.startTimer(() => {
      timerHandleByRecordingId.delete(recording.id);
      options.onDurationCapReached(recording);
    }, options.longestDurationMs);
    timerHandleByRecordingId.set(recording.id, timerHandle);
  }

  /** Calls off the wait of every recording that is no longer open in these slices. */
  function callOffTheWaitsOfClosedRecordings(slices: Slices): void {
    for (const [recordingId, timerHandle] of timerHandleByRecordingId) {
      const isStillOpen = slices.recordings.some(
        (recording) => recording.id === recordingId && recording.endedAtMs === null,
      );
      if (!isStillOpen) {
        options.cancelTimer(timerHandle);
        timerHandleByRecordingId.delete(recordingId);
      }
    }
  }

  /** Calls off every wait: the server is closing. */
  function callOffEveryWait(): void {
    for (const timerHandle of timerHandleByRecordingId.values()) {
      options.cancelTimer(timerHandle);
    }
    timerHandleByRecordingId.clear();
  }

  return { startWaitingFor, callOffTheWaitsOfClosedRecordings, callOffEveryWait };
}
