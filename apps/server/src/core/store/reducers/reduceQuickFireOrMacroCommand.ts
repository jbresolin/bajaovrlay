import type {
  AdvanceMacroRunCommand,
  CreateMacroCommand,
  CreateQuickFirePanelCommand,
  DeleteMacroCommand,
  DeleteQuickFirePanelCommand,
  EndMacroRunCommand,
  MoveItemToHomeCommand,
  RenameQuickFirePanelCommand,
  RunMacroCommand,
  UpdateMacroCommand,
} from '@bajaovrlay/shared';

import { reduceCreateMacro } from './createMacro.js';
import { reduceCreateQuickFirePanel } from './createQuickFirePanel.js';
import { reduceDeleteMacro } from './deleteMacro.js';
import { reduceDeleteQuickFirePanel } from './deleteQuickFirePanel.js';
import { reduceAdvanceMacroRun, reduceEndMacroRun } from './macroRunBookkeeping.js';
import { reduceMoveItemToHome } from './moveItemToHome.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceRenameQuickFirePanel } from './renameQuickFirePanel.js';
import { reduceRunMacro } from './runMacro.js';
import { reduceUpdateMacro } from './updateMacro.js';

/** The ten commands of BAJAOVRLAY-16: quick-fire panels, moving items, macros. */
export type QuickFireOrMacroCommand =
  | CreateQuickFirePanelCommand
  | RenameQuickFirePanelCommand
  | DeleteQuickFirePanelCommand
  | MoveItemToHomeCommand
  | CreateMacroCommand
  | UpdateMacroCommand
  | DeleteMacroCommand
  | RunMacroCommand
  | AdvanceMacroRunCommand
  | EndMacroRunCommand;

/**
 * Sends a quick-fire panel or macro command to its reducer (one file per command, the
 * runner's two bookkeeping commands sharing one). Pure, like reduceCommand, which calls
 * this for those ten commands; a second switch keeps reduceCommand.ts short.
 */
export function reduceQuickFireOrMacroCommand(
  slices: SlicesChangedByCommands,
  command: QuickFireOrMacroCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'createQuickFirePanel':
      return reduceCreateQuickFirePanel(slices, command, context);
    case 'renameQuickFirePanel':
      return reduceRenameQuickFirePanel(slices, command);
    case 'deleteQuickFirePanel':
      return reduceDeleteQuickFirePanel(slices, command);
    case 'moveItemToHome':
      return reduceMoveItemToHome(slices, command);
    case 'createMacro':
      return reduceCreateMacro(slices, command, context);
    case 'updateMacro':
      return reduceUpdateMacro(slices, command);
    case 'deleteMacro':
      return reduceDeleteMacro(slices, command);
    case 'runMacro':
      return reduceRunMacro(slices, command, context);
    case 'advanceMacroRun':
      return reduceAdvanceMacroRun(slices, command);
    case 'endMacroRun':
      return reduceEndMacroRun(slices, command);
  }
}
