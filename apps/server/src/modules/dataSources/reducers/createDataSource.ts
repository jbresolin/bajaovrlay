import type { CreateDataSourceCommand, DataSource } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { buildStatusOfANewSource } from '../dataSourceHealth.js';
import { checkDataSourceConfig } from '../schema.js';

/**
 * createDataSource ("+ Fonte"): adds the source after the others, off, with the id the
 * store made and its config completed by the schema of its kind. Refused when the config
 * fails that schema (INVALID_DATA_SOURCE_CONFIG) or a replay names a recording that is
 * missing or still open (RECORDING_NOT_FOUND). A new source starts off: the operator
 * turns it on when ready, and turning it on is what starts its timeline.
 */
export function reduceCreateDataSource(
  slices: SlicesChangedByCommands,
  command: CreateDataSourceCommand,
  context: ReducerContext,
): ReducerOutcome {
  const configCheck = checkDataSourceConfig(command.kind, command.config, slices.recordings);
  if (!configCheck.isValid) {
    return { status: 'refused', error: configCheck.error };
  }

  const newSource: DataSource = {
    id: context.newDataSourceId,
    label: command.label,
    pollIntervalMs: command.pollIntervalMs,
    isEnabled: false,
    isRecording: false,
    status: buildStatusOfANewSource(command.pollIntervalMs),
    ...configCheck.kindAndConfig,
  };
  return {
    status: 'applied',
    slices: { ...slices, dataSources: [...slices.dataSources, newSource] },
  };
}
