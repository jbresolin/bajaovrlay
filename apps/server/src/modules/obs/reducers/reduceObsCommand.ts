import type {
  RecordObsSceneSwitchAnswerCommand,
  RecordObsStateCommand,
  SwitchObsSceneCommand,
} from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceRecordObsSceneSwitchAnswer, reduceRecordObsState } from './obsConnectionReports.js';
import { reduceSwitchObsScene } from './switchObsScene.js';

/** The three commands of OBS control. */
export type ObsCommand =
  SwitchObsSceneCommand | RecordObsStateCommand | RecordObsSceneSwitchAnswerCommand;

/** Sends each OBS command to its reducer; core's reduceCommand calls it. Pure. */
export function reduceObsCommand(
  slices: SlicesChangedByCommands,
  command: ObsCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'switchObsScene':
      return reduceSwitchObsScene(slices, command, context);
    case 'recordObsState':
      return reduceRecordObsState(slices, command);
    case 'recordObsSceneSwitchAnswer':
      return reduceRecordObsSceneSwitchAnswer(slices, command);
  }
}
