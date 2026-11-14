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
import { holdQueuedEventsForThePause } from '../../events/index.js';
import { refuseUnknownTrigger } from '../triggerRefusals.js';

/** Whether the macro a trigger would name exists. */
function doesMacroExist(slices: SlicesChangedByCommands, macroId: string): boolean {
  return slices.macros.some((macro) => macro.id === macroId);
}

/**
 * The trigger with the moment its interval counts from (BAJAOVRLAY-64), worked out from
 * what it was before (undefined for a new one): a schedule every N minutes that is on gets
 * the moment of this command when it was just switched on, when its schedule changed, or
 * when it has none; otherwise it keeps the one it had. Any other kind carries none.
 * Deliberate: switching it off and on again starts the count again, which is what "counted
 * from the moment it is switched on" means to the operator.
 */
function stampTheMomentTheIntervalCountsFrom(
  trigger: Trigger,
  triggerBefore: Trigger | undefined,
  nowMs: number,
): Trigger {
  const { intervalCountedFromMs, ...triggerWithoutTheMoment } = trigger;
  const isInterval =
    trigger.when.kind === 'schedule' && trigger.when.moment.kind === 'everyMinutes';
  if (!isInterval) {
    return triggerWithoutTheMoment;
  }
  const wasJustSwitchedOn = trigger.isEnabled && triggerBefore?.isEnabled !== true;
  const hasTheScheduleChanged =
    triggerBefore !== undefined &&
    JSON.stringify(triggerBefore.when) !== JSON.stringify(trigger.when);
  const mustCountFromNow =
    trigger.isEnabled &&
    (wasJustSwitchedOn || hasTheScheduleChanged || intervalCountedFromMs === undefined);
  if (mustCountFromNow) {
    return { ...triggerWithoutTheMoment, intervalCountedFromMs: nowMs };
  }
  if (intervalCountedFromMs === undefined) {
    return triggerWithoutTheMoment;
  }
  return { ...triggerWithoutTheMoment, intervalCountedFromMs };
}

/**
 * createTrigger: adds a trigger, last, with the id the store handed in. Refused when its
 * macro does not exist. Whether an OBS scene or a Programação slot it names exists is not
 * checked: OBS may be closed while the show is prepared, and a slot may come later. A
 * schedule every N minutes made on counts from this command.
 */
export function reduceCreateTrigger(
  slices: SlicesChangedByCommands,
  command: CreateTriggerCommand,
  context: ReducerContext,
): ReducerOutcome {
  if (!doesMacroExist(slices, command.macroId)) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const newTrigger: Trigger = {
    id: context.newTriggerId,
    name: command.name,
    isEnabled: command.isEnabled,
    when: command.when,
    macroId: command.macroId,
    mode: command.mode,
    minimumIntervalMs: command.minimumIntervalMs,
  };
  const trigger = stampTheMomentTheIntervalCountsFrom(
    newTrigger,
    undefined,
    Date.parse(context.now),
  );
  return { status: 'applied', slices: { ...slices, triggers: [...slices.triggers, trigger] } };
}

/**
 * updateTrigger: changes what the command names, keeping the rest. Refused for a trigger
 * or a macro that does not exist. A change to what the trigger already says hands back the
 * same slices, so a "Salvar" with nothing changed is neither saved nor broadcast. A
 * schedule every N minutes counts again from this command when it is switched on or its
 * schedule changes.
 */
export function reduceUpdateTrigger(
  slices: SlicesChangedByCommands,
  command: UpdateTriggerCommand,
  context: ReducerContext,
): ReducerOutcome {
  const trigger = slices.triggers.find((candidate) => candidate.id === command.triggerId);
  if (trigger === undefined) {
    return { status: 'refused', error: refuseUnknownTrigger(command.triggerId) };
  }
  if (command.macroId !== undefined && !doesMacroExist(slices, command.macroId)) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const triggerAsChanged: Trigger = {
    ...trigger,
    name: command.name ?? trigger.name,
    isEnabled: command.isEnabled ?? trigger.isEnabled,
    when: command.when ?? trigger.when,
    macroId: command.macroId ?? trigger.macroId,
    mode: command.mode ?? trigger.mode,
    minimumIntervalMs: command.minimumIntervalMs ?? trigger.minimumIntervalMs,
  };
  const updatedTrigger = stampTheMomentTheIntervalCountsFrom(
    triggerAsChanged,
    trigger,
    Date.parse(context.now),
  );
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
 * setTriggersPaused: "Pausar gatilhos", for a rehearsal, a podium or an interview: nothing
 * goes on air by itself. While paused nothing fires; the firings already waiting stay, and
 * can be run or dismissed. Since BAJAOVRLAY-73 it holds the automatic events too: the
 * pause moves every queued event to pending (the inbox then lists new ones pending too),
 * and resuming moves nothing back, so nothing is replayed. The same value again changes
 * nothing.
 */
export function reduceSetTriggersPaused(
  slices: SlicesChangedByCommands,
  command: SetTriggersPausedCommand,
  context: ReducerContext,
): ReducerOutcome {
  if (slices.triggerActivity.isPaused === command.isPaused) {
    return { status: 'applied', slices };
  }
  const triggerActivity = { ...slices.triggerActivity, isPaused: command.isPaused };
  if (!command.isPaused) {
    return { status: 'applied', slices: { ...slices, triggerActivity } };
  }
  const events = holdQueuedEventsForThePause(slices.events, Date.parse(context.now));
  return { status: 'applied', slices: { ...slices, triggerActivity, events } };
}
