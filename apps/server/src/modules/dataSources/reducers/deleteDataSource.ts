import type { DeleteDataSourceCommand } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { findDataSource } from '../dataSourceListing.js';
import { refuseUnknownDataSource } from '../dataSourceRefusals.js';
import { closeOpenRecordingOfSource } from '../recordingBookkeeping.js';

/**
 * deleteDataSource ("Excluir"): removes the source, its snapshot and the operator's
 * corrections of it (they correct nothing any more), and closes its open recording at this
 * moment. What is on air from it stays as it is (rule 4): its live refreshes simply stop. Its recordings stay listed (and their files on disk), so
 * they can still be replayed; each keeps the label the source had. Refused for an
 * unknown source.
 */
export function reduceDeleteDataSource(
  slices: SlicesChangedByCommands,
  command: DeleteDataSourceCommand,
  context: ReducerContext,
): ReducerOutcome {
  const sourceToDelete = findDataSource(slices.dataSources, command.sourceId);
  if (sourceToDelete === undefined) {
    return { status: 'refused', error: refuseUnknownDataSource(command.sourceId) };
  }

  const nowMs = Date.parse(context.now);
  const dataSources = slices.dataSources.filter((source) => source.id !== command.sourceId);
  const hasSnapshot = slices.dataSnapshots.some(
    (snapshot) => snapshot.sourceId === command.sourceId,
  );
  const dataSnapshots = hasSnapshot
    ? slices.dataSnapshots.filter((snapshot) => snapshot.sourceId !== command.sourceId)
    : slices.dataSnapshots;
  const recordings = closeOpenRecordingOfSource(slices.recordings, command.sourceId, nowMs);
  const hasOverrides = slices.overrides.some((override) => override.sourceId === command.sourceId);
  const overrides = hasOverrides
    ? slices.overrides.filter((override) => override.sourceId !== command.sourceId)
    : slices.overrides;
  return {
    status: 'applied',
    slices: { ...slices, dataSources, dataSnapshots, recordings, overrides },
  };
}
