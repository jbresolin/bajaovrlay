import type { DataSource, StopRecordingCommand } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { findDataSource, replaceDataSource } from '../dataSourceListing.js';
import { refuseUnknownDataSource } from '../dataSourceRefusals.js';
import { closeOpenRecordingOfSource } from '../recordingBookkeeping.js';

/**
 * stopRecording ("Parar gravação", or the recorder after a failed write): closes the
 * source's open recording at this moment and marks it not recording. The recorder's
 * stop carries a pt-BR failure message, which the source shows (status.recordingError)
 * until the next recording starts; the source keeps polling either way (decision D9).
 * A stop of a source that is not recording changes nothing. An unknown source is refused
 * for the operator's button, but the recorder's stop of a source deleted a moment ago is
 * an accepted no-op: the recorder sends it from a 0 ms timer and can lose that race, like
 * a late poll (decision D8), so it must not write a refusal row it can do nothing about.
 */
export function reduceStopRecording(
  slices: SlicesChangedByCommands,
  command: StopRecordingCommand,
  context: ReducerContext,
): ReducerOutcome {
  const source = findDataSource(slices.dataSources, command.sourceId);
  if (source === undefined) {
    // Only the recorder sends a failure message, so its presence marks the recorder's stop.
    const isTheRecordersStop = command.failureMessage !== undefined;
    if (isTheRecordersStop) {
      return { status: 'applied', slices };
    }
    return { status: 'refused', error: refuseUnknownDataSource(command.sourceId) };
  }
  if (!source.isRecording) {
    return { status: 'applied', slices };
  }

  const recordingError = command.failureMessage ?? source.status.recordingError;
  const stoppedSource: DataSource = {
    ...source,
    isRecording: false,
    status: { ...source.status, recordingError },
  };
  const nowMs = Date.parse(context.now);
  return {
    status: 'applied',
    slices: {
      ...slices,
      dataSources: replaceDataSource(slices.dataSources, stoppedSource),
      recordings: closeOpenRecordingOfSource(slices.recordings, source.id, nowMs),
    },
  };
}
