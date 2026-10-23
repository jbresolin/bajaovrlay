import type { Command } from '@bajaovrlay/shared';

import { reduceBindingCommand } from '../../../modules/bindings/index.js';
import { reduceDataSourceCommand } from '../../../modules/dataSources/index.js';
import { reduceEntityCommand } from '../../../modules/entities/index.js';
import { reduceClearAll } from './clearAll.js';
import { reduceClearLayer } from './clearLayer.js';
import { dropBindingsOfInstancesGone } from './instanceBindingsBookkeeping.js';
import { reducePreviewClearLayer } from './previewClearLayer.js';
import { reducePreviewItem } from './previewItem.js';
import { reducePreviewMacro } from './previewMacro.js';
import { reduceItemOrRundownCommand } from './reduceItemOrRundownCommand.js';
import { reduceQuickFireOrMacroCommand } from './reduceQuickFireOrMacroCommand.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceReportInstanceStatus } from './reportInstanceStatus.js';
import { reduceStopPreview } from './stopPreview.js';
import { reduceTakeAllPreviews } from './takeAllPreviews.js';
import { reduceTakePreview } from './takePreview.js';
import { reduceUpdateInstanceData } from './updateInstanceData.js';

/**
 * Sends a valid command to its reducer (one file per command), then drops the bindings of
 * any instance the command removed (instanceBindingsBookkeeping.ts), in this one place so
 * no reducer has to remember. Pure: same slices, command and context always give the
 * same outcome, and nothing is read or written.
 */
export function reduceCommand(
  slices: SlicesChangedByCommands,
  command: Command,
  context: ReducerContext,
): ReducerOutcome {
  const outcome = reduceCommandOfItsType(slices, command, context);
  const haveInstancesChanged =
    outcome.status === 'applied' && outcome.slices.instances !== slices.instances;
  if (outcome.status === 'refused' || !haveInstancesChanged) {
    return outcome;
  }
  return { ...outcome, slices: dropBindingsOfInstancesGone(outcome.slices) };
}

/** The switch from a command's type to its reducer. */
function reduceCommandOfItsType(
  slices: SlicesChangedByCommands,
  command: Command,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'updateInstanceData':
      return reduceUpdateInstanceData(slices, command, context);
    case 'reportInstanceStatus':
      return reduceReportInstanceStatus(slices, command);
    case 'clearLayer':
      return reduceClearLayer(slices, command);
    case 'clearAll':
      return reduceClearAll(slices);
    // The three commands of the preview output.
    case 'previewItem':
      return reducePreviewItem(slices, command, context);
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
    case 'saveOnAirChangesIntoItem':
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
    // Data sources: their reducers live in the module modules/dataSources (decision D6),
    // the first module core reaches, always through the module's index.ts.
    case 'createDataSource':
    case 'updateDataSource':
    case 'deleteDataSource':
    case 'setDataSourceEnabled':
    case 'pollDataSourceNow':
    case 'restartSimulatedRace':
    case 'startRecording':
    case 'stopRecording':
    case 'recordDataSourcePoll':
    case 'recordRecordingProgress':
      return reduceDataSourceCommand(slices, command, context);
    // Bindings (BAJAOVRLAY-20): their reducers live in the module modules/bindings.
    case 'refreshBoundInstanceData':
    case 'setOverride':
    case 'clearOverride':
      return reduceBindingCommand(slices, command, context);
    // The entity library (BAJAOVRLAY-19): its reducers live in the module modules/entities.
    case 'upsertEntity':
    case 'deleteEntity':
    case 'importEntities':
      return reduceEntityCommand(slices, command);
  }
}
