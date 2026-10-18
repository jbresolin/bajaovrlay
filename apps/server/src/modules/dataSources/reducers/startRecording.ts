import type { DataSource, StartRecordingCommand } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { findDataSource, replaceDataSource } from '../dataSourceListing.js';
import { refuseDisabledDataSource, refuseUnknownDataSource } from '../dataSourceRefusals.js';
import { buildRecordingStartingNow } from '../recordingBookkeeping.js';

/**
 * startRecording ("Gravar"): opens a recording of the source named after this moment
 * (with a number after it when the source already has a recording of that millisecond),
 * marks the source recording and clears the reason a past recording stopped. The
 * recording starts empty: the recorder writes the data the source already has as the
 * first line, then appends each good poll (decision D10), and reports the count once
 * each line is in the file (gate 2 on PR #16). A second start while recording changes
 * nothing (two tablets pressing at once); refused for an unknown source, and for a
 * source that is off: nothing would ever be written.
 */
export function reduceStartRecording(
  slices: SlicesChangedByCommands,
  command: StartRecordingCommand,
  context: ReducerContext,
): ReducerOutcome {
  const source = findDataSource(slices.dataSources, command.sourceId);
  if (source === undefined) {
    return { status: 'refused', error: refuseUnknownDataSource(command.sourceId) };
  }
  if (!source.isEnabled) {
    return { status: 'refused', error: refuseDisabledDataSource(source.label) };
  }
  if (source.isRecording) {
    return { status: 'applied', slices };
  }

  const newRecording = buildRecordingStartingNow(
    source,
    Date.parse(context.now),
    slices.recordings,
  );
  const recordingSource: DataSource = {
    ...source,
    isRecording: true,
    status: { ...source.status, recordingError: null },
  };
  return {
    status: 'applied',
    slices: {
      ...slices,
      dataSources: replaceDataSource(slices.dataSources, recordingSource),
      recordings: [...slices.recordings, newRecording],
    },
  };
}
