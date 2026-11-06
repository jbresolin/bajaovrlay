// The history sentences of the commands that change what is on air (BAJAOVRLAY-30): one
// named formatter per command type, gathered in sentenceOfEachCommandType.ts.
import type { EventLogDetails } from '../slices/eventLogEntry.js';
import type { CommandOfType } from './commandOfType.js';
import type { EventLogNames } from './eventLogNames.js';
import {
  nameInboxEvent,
  nameInstance,
  nameItem,
  nameLayerWhereItemWent,
  nameLayerWithItsOutput,
  nameMacro,
  nameRundown,
  nameTriggerFiring,
} from './namesInSentences.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';

const sentences = ptBREventLogReading.takesAndClears;

/**
 * takeItem: "Tomou "Tarja – Ana Souza" na camada Tarja (Programa)", on the layer the row
 * recorded when the take was applied (the item may have moved since).
 */
export function describeTakeItem(
  command: CommandOfType<'takeItem'>,
  names: EventLogNames,
  details?: EventLogDetails,
): string {
  const itemName = nameItem(command.itemId, names);
  const layerName = nameLayerWhereItemWent(command.itemId, details, names);
  if (layerName === undefined) {
    return sentences.tookItemWithoutLayer(itemName);
  }
  return sentences.tookItem(itemName, layerName);
}

/** takeNext: "Tomou o próximo item do rundown "Sessão principal"". */
export function describeTakeNext(command: CommandOfType<'takeNext'>, names: EventLogNames): string {
  return sentences.tookNext(nameRundown(command.rundownId, names));
}

/** takePreview: "Tomou a prévia da camada Tarja (Programa)". */
export function describeTakePreview(
  command: CommandOfType<'takePreview'>,
  names: EventLogNames,
): string {
  return sentences.tookPreview(nameLayerWithItsOutput(command.layerId, names));
}

/** takeAllPreviews ("Tomar tudo"). */
export function describeTakeAllPreviews(): string {
  return sentences.tookAllPreviews;
}

/** clearLayer: both outputs ("Limpar"), or program only (the auto-out's). */
export function describeClearLayer(
  command: CommandOfType<'clearLayer'>,
  names: EventLogNames,
): string {
  const layerName = nameLayerWithItsOutput(command.layerId, names);
  if (command.target === 'program') {
    return sentences.clearedProgramOfLayer(layerName);
  }
  return sentences.clearedLayer(layerName);
}

/** clearAll ("Limpar tudo"). */
export function describeClearAll(): string {
  return sentences.clearedAll;
}

/** nextOnLayer ("Próximo"): the step it moved to, counted from 1 as the operator counts. */
export function describeNextOnLayer(
  command: CommandOfType<'nextOnLayer'>,
  names: EventLogNames,
): string {
  const stepMovedToCountedFromOne = command.fromStep + 2;
  return sentences.movedToNextStep(
    stepMovedToCountedFromOne,
    nameLayerWithItsOutput(command.layerId, names),
  );
}

/** undoOnLayer ("Desfazer" on a Camadas row). */
export function describeUndoOnLayer(
  command: CommandOfType<'undoOnLayer'>,
  names: EventLogNames,
): string {
  return sentences.undidLayer(nameLayerWithItsOutput(command.layerId, names));
}

/** undoLastChangeOnProgram ("Desfazer última", Ctrl+Z). */
export function describeUndoLastChangeOnProgram(): string {
  return sentences.undidLastChange;
}

/** updateInstanceData ("Atualizar" in "Edição rápida"), naming the fields sent. */
export function describeUpdateInstanceData(
  command: CommandOfType<'updateInstanceData'>,
  names: EventLogNames,
): string {
  return sentences.changedOnAir(nameInstance(command.instanceId, names), Object.keys(command.data));
}

/** refreshBoundInstanceData: a source's new values for the fields bound to it. */
export function describeRefreshBoundInstanceData(
  command: CommandOfType<'refreshBoundInstanceData'>,
  names: EventLogNames,
): string {
  return sentences.refreshedFromTheSource(nameInstance(command.instanceId, names));
}

/** reportInstanceStatus: the renderer showed the graphic, or could not (with its detail). */
export function describeReportInstanceStatus(
  command: CommandOfType<'reportInstanceStatus'>,
  names: EventLogNames,
): string {
  const instanceName = nameInstance(command.instanceId, names);
  if (command.status === 'on-air') {
    return sentences.rendererShowed(instanceName);
  }
  if (command.detail === undefined) {
    return sentences.rendererFailed(instanceName);
  }
  return sentences.rendererFailedWithDetail(instanceName, command.detail);
}

/** runMacro. */
export function describeRunMacro(command: CommandOfType<'runMacro'>, names: EventLogNames): string {
  return sentences.ranMacro(nameMacro(command.macroId, names));
}

/** stopMacro ("Parar"). */
export function describeStopMacro(
  command: CommandOfType<'stopMacro'>,
  names: EventLogNames,
): string {
  return sentences.stoppedMacro(nameMacro(command.macroId, names));
}

/** advanceMacroRun: the runner's bookkeeping, the step counted from 1. */
export function describeAdvanceMacroRun(
  command: CommandOfType<'advanceMacroRun'>,
  names: EventLogNames,
): string {
  return sentences.macroMovedToStep(nameMacro(command.macroId, names), command.currentStep + 1);
}

/** endMacroRun: the run ended, or stopped short at a refused step with its reason. */
export function describeEndMacroRun(
  command: CommandOfType<'endMacroRun'>,
  names: EventLogNames,
): string {
  const macroName = nameMacro(command.macroId, names);
  if (command.stoppedAtStep === undefined) {
    return sentences.macroEnded(macroName);
  }
  return sentences.macroStoppedAtStep(
    macroName,
    command.stoppedAtStep.stepIndex + 1,
    command.stoppedAtStep.reason,
  );
}

/** showEvent ("No ar" in the "Eventos" tab, or a rule's auto). */
export function describeShowEvent(
  command: CommandOfType<'showEvent'>,
  names: EventLogNames,
): string {
  return sentences.showedEvent(nameInboxEvent(command.eventId, names));
}

/** switchObsScene, on OBS's Program or Preview. */
export function describeSwitchObsScene(command: CommandOfType<'switchObsScene'>): string {
  const targetLabel = ptBREventLogReading.obsTargetLabels[command.target];
  return sentences.switchedObsScene(command.sceneName, targetLabel);
}

/** recordObsSceneSwitchAnswer: OBS did the switch, or said why not. */
export function describeRecordObsSceneSwitchAnswer(
  command: CommandOfType<'recordObsSceneSwitchAnswer'>,
): string {
  if (command.isDone) {
    return sentences.obsDidTheSwitch(command.number);
  }
  if (command.refusalReason === null) {
    return sentences.obsDidNotDoTheSwitch(command.number);
  }
  return sentences.obsRefusedTheSwitch(command.number, command.refusalReason);
}

/**
 * fireTrigger: the trigger by the name it had when it fired (carried in the command, so
 * the row reads after a rename or a delete), and its data, "carro: 47, motivo: …", in the
 * order the data came. A firing with no data (a time of day) names only the trigger.
 */
export function describeFireTrigger(command: CommandOfType<'fireTrigger'>): string {
  const triggerName = `"${command.triggerName}"`;
  const dataEntries = Object.entries(command.data);
  if (dataEntries.length === 0) {
    return sentences.triggerFired(triggerName);
  }
  const dataTexts = dataEntries.map(([key, value]) => `${key}: ${String(value)}`);
  return sentences.triggerFiredWithData(triggerName, dataTexts.join(', '));
}

/** runTriggerFiring: "Rodar" on a firing that waits in the Eventos tab. */
export function describeRunTriggerFiring(
  command: CommandOfType<'runTriggerFiring'>,
  names: EventLogNames,
): string {
  return sentences.ranFiring(nameTriggerFiring(command.firingId, names));
}
