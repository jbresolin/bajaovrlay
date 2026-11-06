// Everything about undo on program (BAJAOVRLAY-30) that @bajaovrlay/shared exports. The
// package's own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The `programHistory` slice: what each layer showed before its last ten changes.
export {
  type LayerProgramHistory,
  LayerProgramHistorySchema,
  type ProgramHistory,
  type ProgramHistoryEntry,
  ProgramHistoryEntrySchema,
  programHistoryLimitPerLayer,
  ProgramHistorySchema,
  type ProgramHistoryShown,
  ProgramHistoryShownSchema,
} from './programHistory.js';
// undoOnLayer ("Desfazer" on a layer) and undoLastChangeOnProgram ("Desfazer última", Ctrl+Z).
export {
  type UndoLastChangeOnProgramCommand,
  UndoLastChangeOnProgramCommandSchema,
  type UndoOnLayerCommand,
  UndoOnLayerCommandSchema,
} from './undoCommands.js';
