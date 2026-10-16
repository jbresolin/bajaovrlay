import type { Command } from '@bajaovrlay/shared';

import { reduceClearAll } from './clearAll.js';
import { reduceClearLayer } from './clearLayer.js';
import { reducePreviewClearLayer } from './previewClearLayer.js';
import { reducePreviewGraphic } from './previewGraphic.js';
import { reducePreviewItem } from './previewItem.js';
import { reducePreviewMacro } from './previewMacro.js';
import { reduceItemOrRundownCommand } from './reduceItemOrRundownCommand.js';
import { reduceQuickFireOrMacroCommand } from './reduceQuickFireOrMacroCommand.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceReportInstanceStatus } from './reportInstanceStatus.js';
import { reduceStopPreview } from './stopPreview.js';
import { reduceTakeAllPreviews } from './takeAllPreviews.js';
import { reduceTakeGraphic } from './takeGraphic.js';
import { reduceTakePreview } from './takePreview.js';
import { reduceUpdateInstanceData } from './updateInstanceData.js';

/**
 * Sends a valid command to its reducer (one file per command). Pure: same slices,
 * command and context always give the same outcome, and nothing is read or written.
 */
export function reduceCommand(
  slices: SlicesChangedByCommands,
  command: Command,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'takeGraphic':
      return reduceTakeGraphic(slices, command, context);
    case 'updateInstanceData':
      return reduceUpdateInstanceData(slices, command, context);
    case 'reportInstanceStatus':
      return reduceReportInstanceStatus(slices, command);
    case 'clearLayer':
      return reduceClearLayer(slices, command);
    case 'clearAll':
      return reduceClearAll(slices);
    // The four commands of the preview output.
    case 'previewItem':
      return reducePreviewItem(slices, command, context);
    case 'previewGraphic':
      return reducePreviewGraphic(slices, command, context);
    case 'stopPreview':
      return reduceStopPreview(slices, command);
    case 'takePreview':
      return reduceTakePreview(slices, command, context);
    // Prévia shows the result: the "will be cleared" marker, "Tomar tudo", a macro's Prévia.
    case 'previewClearLayer':
      return reducePreviewClearLayer(slices, command);
    case 'takeAllPreviews':
      return reduceTakeAllPreviews(slices, context);
    case 'previewMacro':
      return reducePreviewMacro(slices, command, context);
    // The item and rundown commands have a switch of their own, one reducer file each.
    case 'createItem':
    case 'updateItemFields':
    case 'deleteItem':
    case 'reorderItems':
    case 'moveCursor':
    case 'takeItem':
    case 'takeNext':
      return reduceItemOrRundownCommand(slices, command, context);
    // Quick-fire panels, moving items between homes, and macros: a switch of their own.
    case 'createQuickFirePanel':
    case 'renameQuickFirePanel':
    case 'deleteQuickFirePanel':
    case 'moveItemToHome':
    case 'createMacro':
    case 'updateMacro':
    case 'deleteMacro':
    case 'runMacro':
    case 'stopMacro':
    case 'advanceMacroRun':
    case 'endMacroRun':
      return reduceQuickFireOrMacroCommand(slices, command, context);
  }
}
