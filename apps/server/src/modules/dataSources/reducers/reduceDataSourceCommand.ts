import type {
  CreateDataSourceCommand,
  DeleteDataSourceCommand,
  PollDataSourceNowCommand,
  RecordDataSourcePollCommand,
  RecordRecordingProgressCommand,
  SetDataSourceEnabledCommand,
  StartRecordingCommand,
  StopRecordingCommand,
  UpdateDataSourceCommand,
} from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceCreateDataSource } from './createDataSource.js';
import { reduceDeleteDataSource } from './deleteDataSource.js';
import { reducePollDataSourceNow } from './pollDataSourceNow.js';
import { reduceRecordDataSourcePoll } from './recordDataSourcePoll.js';
import { reduceRecordRecordingProgress } from './recordRecordingProgress.js';
import { reduceSetDataSourceEnabled } from './setDataSourceEnabled.js';
import { reduceStartRecording } from './startRecording.js';
import { reduceStopRecording } from './stopRecording.js';
import { reduceUpdateDataSource } from './updateDataSource.js';

/**
 * The nine commands of BAJAOVRLAY-17: seven from the "Fontes" page, one from the poller
 * and one from the recorder.
 */
export type DataSourceCommand =
  | CreateDataSourceCommand
  | UpdateDataSourceCommand
  | DeleteDataSourceCommand
  | SetDataSourceEnabledCommand
  | PollDataSourceNowCommand
  | StartRecordingCommand
  | StopRecordingCommand
  | RecordDataSourcePollCommand
  | RecordRecordingProgressCommand;

/**
 * Sends a data-source command to its reducer (one file per command). Pure, like core's
 * reduceCommand, which calls this for those nine commands (decision D6: the reducers
 * live in the module, next to the rest of what data sources are).
 */
export function reduceDataSourceCommand(
  slices: SlicesChangedByCommands,
  command: DataSourceCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'createDataSource':
      return reduceCreateDataSource(slices, command, context);
    case 'updateDataSource':
      return reduceUpdateDataSource(slices, command, context);
    case 'deleteDataSource':
      return reduceDeleteDataSource(slices, command, context);
    case 'setDataSourceEnabled':
      return reduceSetDataSourceEnabled(slices, command, context);
    case 'pollDataSourceNow':
      return reducePollDataSourceNow(slices, command, context);
    case 'startRecording':
      return reduceStartRecording(slices, command, context);
    case 'stopRecording':
      return reduceStopRecording(slices, command, context);
    case 'recordDataSourcePoll':
      return reduceRecordDataSourcePoll(slices, command);
    case 'recordRecordingProgress':
      return reduceRecordRecordingProgress(slices, command);
  }
}
