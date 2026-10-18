import type { DataSource, SetDataSourceEnabledCommand } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { findDataSource, replaceDataSource } from '../dataSourceListing.js';
import { refuseUnknownDataSource } from '../dataSourceRefusals.js';
import { startTheTimelineAtEnable } from '../dataSourceTimeline.js';
import { closeOpenRecordingOfSource } from '../recordingBookkeeping.js';

/**
 * setDataSourceEnabled (the switch on a source's row).
 * On: starts the source's timeline (startTheTimelineAtEnable, decision D5) and starts
 * its health again: no error, no failure counted, and stale when it has a snapshot,
 * because that data is from before it was turned off and is late until the next good
 * poll. A source with no snapshot has nothing late to warn about.
 * Off: not stale (a source that is off is off, not late), its snapshot kept (rule 4),
 * and its recording stopped and closed at this moment.
 * Hands back the same slices when the source is already in that state; refused for an
 * unknown source.
 */
export function reduceSetDataSourceEnabled(
  slices: SlicesChangedByCommands,
  command: SetDataSourceEnabledCommand,
  context: ReducerContext,
): ReducerOutcome {
  const source = findDataSource(slices.dataSources, command.sourceId);
  if (source === undefined) {
    return { status: 'refused', error: refuseUnknownDataSource(command.sourceId) };
  }
  if (source.isEnabled === command.isEnabled) {
    return { status: 'applied', slices };
  }

  const nowMs = Date.parse(context.now);
  if (command.isEnabled) {
    const hasSnapshotFromBefore = slices.dataSnapshots.some(
      (snapshot) => snapshot.sourceId === source.id,
    );
    const sourceTurnedOn: DataSource = {
      ...source,
      isEnabled: true,
      status: {
        ...source.status,
        lastError: null,
        consecutiveFailures: 0,
        isStale: hasSnapshotFromBefore,
      },
    };
    const sourceWithItsTimeline = startTheTimelineAtEnable(sourceTurnedOn, nowMs);
    const dataSources = replaceDataSource(slices.dataSources, sourceWithItsTimeline);
    return { status: 'applied', slices: { ...slices, dataSources } };
  }

  const sourceTurnedOff: DataSource = {
    ...source,
    isEnabled: false,
    isRecording: false,
    status: { ...source.status, isStale: false },
  };
  const dataSources = replaceDataSource(slices.dataSources, sourceTurnedOff);
  const recordings = closeOpenRecordingOfSource(slices.recordings, source.id, nowMs);
  return { status: 'applied', slices: { ...slices, dataSources, recordings } };
}
