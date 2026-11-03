// Everything about OBS control that @bajaovrlay/shared exports. The package's own index.ts
// re-exports this file with one line; other packages import from '@bajaovrlay/shared',
// never from here.

// The `obs` slice: the connection, OBS's scenes, Program and Preview, the latest switch.
export {
  type ObsConnectionState,
  ObsConnectionStateSchema,
  type ObsSceneSwitch,
  ObsSceneSwitchSchema,
  type ObsSceneTarget,
  ObsSceneTargetSchema,
  type ObsSlice,
  ObsSliceSchema,
  obsSliceWithoutObs,
  type ObsStatus,
  ObsStatusSchema,
} from './obsSlice.js';
// switchObsScene (operators, macro steps), and the two reports of the server's connection.
export {
  type RecordObsSceneSwitchAnswerCommand,
  RecordObsSceneSwitchAnswerCommandSchema,
  type RecordObsStateCommand,
  RecordObsStateCommandSchema,
  type SwitchObsSceneCommand,
  SwitchObsSceneCommandSchema,
} from './obsCommands.js';
