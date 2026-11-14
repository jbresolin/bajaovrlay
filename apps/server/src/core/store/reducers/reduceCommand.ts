import type { Command } from '@bajaovrlay/shared';

import { reduceRecordBackup } from '../../../modules/backup/index.js';
import { reduceBindingCommand } from '../../../modules/bindings/index.js';
import { reduceBracketMatchFocusCommand } from '../../../modules/bracketMatchFocus/index.js';
import { reduceDataSourceCommand } from '../../../modules/dataSources/index.js';
import { reduceEntityCommand } from '../../../modules/entities/index.js';
import {
  followEventsOfProgramInstances,
  reduceEventInboxCommand,
} from '../../../modules/events/index.js';
import { reduceMediaCommand } from '../../../modules/media/index.js';
import { reduceObsCommand } from '../../../modules/obs/index.js';
import { reduceOutputOrLayerCommand } from '../../../modules/outputs/index.js';
import { reduceTriggerCommand } from '../../../modules/triggers/index.js';
import { forgetChangesThatCannotComeBack } from '../programHistory/forgetChangesThatCannotComeBack.js';
import { rememberProgramChanges } from '../programHistory/rememberProgramChanges.js';
import { reduceUndoLastChangeOnProgram } from '../programHistory/undoLastChangeOnProgram.js';
import { reduceUndoOnLayer } from '../programHistory/undoOnLayer.js';
import { reduceClearAll } from './clearAll.js';
import { reduceClearLayer } from './clearLayer.js';
import { dropBindingsOfInstancesGone } from './instanceBindingsBookkeeping.js';
import { keepCurrentStepsWithinTheirStepCount } from './instanceStepsWithinTheirCount.js';
import { reduceNextOnLayer } from './nextOnLayer.js';
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
 * Sends a valid command to its reducer (one file per command), then remembers what each
 * layer's program output showed before the command changed it (programHistory, for
 * "Desfazer"; BAJAOVRLAY-30), unless the command is itself an undo, and, when the instances
 * changed, drops the bindings of any instance the command removed
 * (instanceBindingsBookkeeping.ts), puts an instance whose new data has fewer steps than
 * the one it is on on its last step (instanceStepsWithinTheirCount.ts, BAJAOVRLAY-25), and
 * moves the inbox's events on or off the air with the instances carrying them
 * (modules/events, BAJAOVRLAY-44), in this one place so no reducer has to remember. Pure:
 * same slices, command and context always give the same outcome, and nothing is read or
 * written.
 */
export function reduceCommand(
  slices: SlicesChangedByCommands,
  command: Command,
  context: ReducerContext,
): ReducerOutcome {
  const outcomeOfItsType = reduceCommandOfItsType(slices, command, context);
  if (outcomeOfItsType.status === 'refused') {
    return outcomeOfItsType;
  }
  const outcome = withProgramChangesRemembered(slices, command, outcomeOfItsType, context.now);
  const haveInstancesChanged = outcome.slices.instances !== slices.instances;
  if (!haveInstancesChanged) {
    return outcome;
  }
  const slicesWithBindingsKept = dropBindingsOfInstancesGone(outcome.slices);
  const stepsKept = keepCurrentStepsWithinTheirStepCount(slicesWithBindingsKept);
  const slicesAfter = followEventsOfProgramInstances(stepsKept.slices, context.now);
  if (stepsKept.stepsBroughtBack.length === 0) {
    return { ...outcome, slices: slicesAfter };
  }
  return { ...outcome, slices: slicesAfter, stepsBroughtBack: stepsKept.stepsBroughtBack };
}

/**
 * The outcome with programHistory brought up to date (rememberProgramChanges.ts), and
 * without the changes of an item deleted by the command (forgetChangesThatCannotComeBack.ts). An undo
 * is left as its reducer wrote it: it pops the history and must not push what it replaced,
 * or a second press would undo the undo.
 */
function withProgramChangesRemembered(
  slicesBefore: SlicesChangedByCommands,
  command: Command,
  outcome: Extract<ReducerOutcome, { status: 'applied' }>,
  now: string,
): Extract<ReducerOutcome, { status: 'applied' }> {
  const isAnUndo = command.type === 'undoOnLayer' || command.type === 'undoLastChangeOnProgram';
  if (isAnUndo) {
    return outcome;
  }
  const programHistoryWithTheChange = rememberProgramChanges(slicesBefore, outcome.slices, now);
  // A deleted item (or a graphic gone) must not jam undo: its entries are forgotten here,
  // in the same step, as a deleted layer's are (forgetChangesThatCannotComeBack.ts).
  const haveItemsOrGraphicsChanged =
    outcome.slices.items !== slicesBefore.items ||
    outcome.slices.graphics !== slicesBefore.graphics;
  const programHistoryAfter = haveItemsOrGraphicsChanged
    ? forgetChangesThatCannotComeBack(
        programHistoryWithTheChange,
        outcome.slices.items,
        outcome.slices.graphics,
      )
    : programHistoryWithTheChange;
  if (programHistoryAfter === outcome.slices.programHistory) {
    return outcome;
  }
  return { ...outcome, slices: { ...outcome.slices, programHistory: programHistoryAfter } };
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
    // "Próximo": the next step of the graphic on air on a layer (BAJAOVRLAY-47).
    case 'nextOnLayer':
      return reduceNextOnLayer(slices, command);
    // "Desfazer" and "Desfazer última" (BAJAOVRLAY-30); ../programHistory/.
    case 'undoOnLayer':
      return reduceUndoOnLayer(slices, command, context);
    case 'undoLastChangeOnProgram':
      return reduceUndoLastChangeOnProgram(slices, context);
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
      return reduceTakeAllPreviews(slices, command, context);
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
    // The match focus of a Super Prime (BAJAOVRLAY-65): modules/bracketMatchFocus.
    case 'setBracketMatchFocus':
    case 'acceptSuggestedBracketMatches':
      return reduceBracketMatchFocusCommand(slices, command);
    // The event inbox (BAJAOVRLAY-44): its reducers live in the module modules/events.
    case 'showEvent':
    case 'approveEvent':
    case 'dismissEvent':
    case 'restoreEvent':
    case 'createManualEvent':
    case 'updateEventRule':
    case 'recordDetectedEvents':
      return reduceEventInboxCommand(slices, command, context);
    // The entity library (BAJAOVRLAY-19): its reducers live in the module modules/entities.
    case 'upsertEntity':
    case 'deleteEntity':
    case 'importEntities':
      return reduceEntityCommand(slices, command);
    // The media store (BAJAOVRLAY-19): its reducers live in the module modules/media.
    case 'recordUploadedMedia':
    case 'deleteMedia':
      return reduceMediaCommand(slices, command, context);
    // The backup download (BAJAOVRLAY-33): its reducer lives in the module modules/backup.
    case 'recordBackup':
      return reduceRecordBackup(slices);
    // Outputs and the editing of layers (BAJAOVRLAY-49): their reducers live in the module
    // modules/outputs.
    case 'createOutput':
    case 'renameOutput':
    case 'deleteOutput':
    case 'reorderOutputs':
    case 'createLayer':
    case 'updateLayer':
    case 'moveLayerToOutput':
    case 'reorderLayers':
    case 'deleteLayer':
      return reduceOutputOrLayerCommand(slices, command);
    // OBS control (BAJAOVRLAY-27): its reducers live in the module modules/obs.
    case 'switchObsScene':
    case 'recordObsState':
    case 'recordObsSceneSwitchAnswer':
      return reduceObsCommand(slices, command, context);
    // Triggers (BAJAOVRLAY-48): their reducers live in the module modules/triggers.
    case 'createTrigger':
    case 'updateTrigger':
    case 'deleteTrigger':
    case 'setTriggersPaused':
    case 'fireTrigger':
    case 'runTriggerFiring':
    case 'dismissTriggerFiring':
    case 'restoreTriggerFiring':
      return reduceTriggerCommand(slices, command, context);
  }
}
