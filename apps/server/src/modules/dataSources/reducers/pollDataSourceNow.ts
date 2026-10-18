import type { PollDataSourceNowCommand } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { findDataSource, replaceDataSource } from '../dataSourceListing.js';
import { refuseDisabledDataSource, refuseUnknownDataSource } from '../dataSourceRefusals.js';

/**
 * pollDataSourceNow ("Atualizar agora"): stamps the moment of the request on the source.
 * A command reaches the poller only through state, so the poller watches this field and
 * polls at once when it changes, unless a poll is already in flight (decision D7).
 * Refused for an unknown source, and for a source that is off: no loop would answer.
 */
export function reducePollDataSourceNow(
  slices: SlicesChangedByCommands,
  command: PollDataSourceNowCommand,
  context: ReducerContext,
): ReducerOutcome {
  const source = findDataSource(slices.dataSources, command.sourceId);
  if (source === undefined) {
    return { status: 'refused', error: refuseUnknownDataSource(command.sourceId) };
  }
  if (!source.isEnabled) {
    return { status: 'refused', error: refuseDisabledDataSource(source.label) };
  }

  const sourceWithTheRequest = { ...source, pollNowRequestedAtMs: Date.parse(context.now) };
  const dataSources = replaceDataSource(slices.dataSources, sourceWithTheRequest);
  return { status: 'applied', slices: { ...slices, dataSources } };
}
