import type { RecordRecordingProgressCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { setSnapshotCountOfRecording } from '../recordingBookkeeping.js';

/**
 * recordRecordingProgress (sent only by the recorder, `sistema:gravador`): the number of
 * lines now in a recording's file becomes its snapshotCount, so the list never counts a
 * snapshot the disk does not hold (gate 2 on PR #16). It applies to a closed recording
 * too: a line written just before "Parar gravação" is reported just after it, and it is
 * in the file. A report that changes no count (a repeat, or a recording the list does
 * not hold) hands back the same slices, so nothing is saved or broadcast, and nothing is
 * refused either: the recorder can do nothing about it. Every report is left out of the
 * event log, like a routine poll (decision D11): one arrives every poll per recording.
 */
export function reduceRecordRecordingProgress(
  slices: SlicesChangedByCommands,
  command: RecordRecordingProgressCommand,
): ReducerOutcome {
  const recordings = setSnapshotCountOfRecording(
    slices.recordings,
    command.recordingId,
    command.snapshotCount,
  );
  if (recordings === slices.recordings) {
    return { status: 'applied', slices };
  }
  return {
    status: 'applied',
    slices: { ...slices, recordings },
    isLeftOutOfTheEventLog: true,
  };
}
