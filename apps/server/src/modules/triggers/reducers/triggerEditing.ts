// The operator's edits of triggers on "Gatilhos" (BAJAOVRLAY-48): create, update, delete,
// and the global "Pausar gatilhos".
import type {
  CreateTriggerCommand,
  DeleteTriggerCommand,
  SetTriggersPausedCommand,
  Trigger,
  UpdateTriggerCommand,
} from '@bajaovrlay/shared';

import { refuseUnknownMacro } from '../../../core/store/quickFireAndMacroRefusals.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseUnknownTrigger } from '../triggerRefusals.js';

/** Whether the macro a trigger would name exists. */
function doesMacroExist(slices: SlicesChangedByCommands, macroId: string): boolean {
  return slices.macros.some((macro) => macro.id === macroId);
}

/**
 * createTrigger: adds a trigger, last, with the id the store handed in. Refused when its
 * macro does not exist. Whether an OBS scene or a Programação slot it names exists is not
 * checked: OBS may be closed while the show is prepared, and a slot may come later.
 */
export function reduceCreateTrigger(
  slices: SlicesChangedByCommands,
  command: CreateTriggerCommand,
  context: ReducerContext,
): ReducerOutcome {
  if (!doesMacroExist(slices, command.macroId)) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const trigger: Trigger = {
    id: context.newTriggerId,
    name: command.name,
    isEnabled: command.isEnabled,
    when: command.when,
    macroId: command.macroId,
    mode: command.mode,
    minimumIntervalMs: command.minimumIntervalMs,
  };
  return { status: 'applied', slices: { ...slices, triggers: [...slices.triggers, trigger] } };
}

/**
 * updateTrigger: changes what the command names, keeping the rest. Refused for a trigger
 * or a macro that does not exist. A change to what the trigger already says hands back the
 * same slices, so a "Salvar" with nothing changed is neither saved nor broadcast.
 */
export function reduceUpdateTrigger(
  slices: SlicesChangedByCommands,
  command: UpdateTriggerCommand,
): ReducerOutcome {
  const trigger = slices.triggers.find((candidate) => candidate.id === command.triggerId);
  if (trigger === undefined) {
    return { status: 'refused', error: refuseUnknownTrigger(command.triggerId) };
  }
  if (command.macroId !== undefined && !doesMacroExist(slices, command.macroId)) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const updatedTrigger: Trigger = {
    id: trigger.id,
    name: command.name ?? trigger.name,
    isEnabled: command.isEnabled ?? trigger.isEnabled,
    when: command.when ?? trigger.when,
    macroId: command.macroId ?? trigger.macroId,
    mode: command.mode ?? trigger.mode,
    minimumIntervalMs: command.minimumIntervalMs ?? trigger.minimumIntervalMs,
  };
  const isUnchanged = JSON.stringify(updatedTrigger) === JSON.stringify(trigger);
  if (isUnchanged) {
    return { status: 'applied', slices };
  }
  const triggersAfter = slices.triggers.map((candidate) =>
    candidate.id === trigger.id ? updatedTrigger : candidate,
  );
  return { status: 'applied', slices: { ...slices, triggers: triggersAfter } };
}

/**
 * deleteTrigger: removes a trigger. Its firings stay in the activity, named as they were,
 * and one that waits can still be run: the operator saw it, and its macro still exists.
 */
export function reduceDeleteTrigger(
  slices: SlicesChangedByCommands,
  command: DeleteTriggerCommand,
): ReducerOutcome {
  const isKnown = slices.triggers.some((trigger) => trigger.id === command.triggerId);
  if (!isKnown) {
    return { status: 'refused', error: refuseUnknownTrigger(command.triggerId) };
  }
  const triggersAfter = slices.triggers.filter((trigger) => trigger.id !== command.triggerId);
  return { status: 'applied', slices: { ...slices, triggers: triggersAfter } };
}

/**
 * setTriggersPaused: "Pausar gatilhos" for a rehearsal. While paused nothing fires; the
 * firings already waiting stay, and can be run or dismissed. The same value again changes
 * nothing.
 */
export function reduceSetTriggersPaused(
  slices: SlicesChangedByCommands,
  command: SetTriggersPausedCommand,
): ReducerOutcome {
  if (slices.triggerActivity.isPaused === command.isPaused) {
    return { status: 'applied', slices };
  }
  const triggerActivity = { ...slices.triggerActivity, isPaused: command.isPaused };
  return { status: 'applied', slices: { ...slices, triggerActivity } };
}
