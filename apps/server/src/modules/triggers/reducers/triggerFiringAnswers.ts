// The operator's three answers to a firing that asks (BAJAOVRLAY-48), as the event inbox
// has them: "Rodar", "Descartar", and "Desfazer" after "Descartar".
import type {
  DismissTriggerFiringCommand,
  RestoreTriggerFiringCommand,
  RunTriggerFiringCommand,
  TriggerFiring,
} from '@bajaovrlay/shared';

import { startMacroRun } from '../../../core/store/reducers/macroRunStart.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  refuseFiringNotDismissed,
  refuseFiringNotWaiting,
  refuseUnknownFiring,
} from '../triggerRefusals.js';
import { changeStatusOfFiring } from './triggerActivityChanges.js';

/** The firing a command names, or undefined when it has left the list. */
function findFiring(slices: SlicesChangedByCommands, firingId: string): TriggerFiring | undefined {
  return slices.triggerActivity.firings.find((firing) => firing.firingId === firingId);
}

/**
 * runTriggerFiring ("Rodar"): starts the firing's macro with its data, through the one
 * start every run takes, and marks the firing as run. Refused when the firing no longer
 * waits (it ran, or was dismissed: a second page still showing it), and for every reason a
 * start is refused (another macro is running): the firing then still waits. The trigger
 * being off or paused now does not matter: the operator decided.
 */
export function reduceRunTriggerFiring(
  slices: SlicesChangedByCommands,
  command: RunTriggerFiringCommand,
  context: ReducerContext,
): ReducerOutcome {
  const firing = findFiring(slices, command.firingId);
  if (firing === undefined) {
    return { status: 'refused', error: refuseUnknownFiring() };
  }
  if (firing.status !== 'pending') {
    return { status: 'refused', error: refuseFiringNotWaiting(firing.triggerName) };
  }
  const start = startMacroRun(slices, firing.macroId, context, {
    triggerId: firing.triggerId,
    firingId: firing.firingId,
    data: firing.data,
  });
  if (start.status === 'refused') {
    return start;
  }
  const nowMs = Date.parse(context.now);
  const triggerActivity = changeStatusOfFiring(
    start.slices.triggerActivity,
    firing.firingId,
    'ran',
    nowMs,
  );
  return { status: 'applied', slices: { ...start.slices, triggerActivity } };
}

/** dismissTriggerFiring ("Descartar"): the firing will not run. Refused unless it waits. */
export function reduceDismissTriggerFiring(
  slices: SlicesChangedByCommands,
  command: DismissTriggerFiringCommand,
  context: ReducerContext,
): ReducerOutcome {
  const firing = findFiring(slices, command.firingId);
  if (firing === undefined) {
    return { status: 'refused', error: refuseUnknownFiring() };
  }
  if (firing.status !== 'pending') {
    return { status: 'refused', error: refuseFiringNotWaiting(firing.triggerName) };
  }
  const nowMs = Date.parse(context.now);
  const triggerActivity = changeStatusOfFiring(
    slices.triggerActivity,
    firing.firingId,
    'dismissed',
    nowMs,
  );
  return { status: 'applied', slices: { ...slices, triggerActivity } };
}

/**
 * restoreTriggerFiring ("Desfazer"): a dismissed firing waits again. The console offers it
 * for 30 s after "Descartar", as for events; the server does not count those seconds, so a
 * second page that saw the dismissal later can still undo it.
 */
export function reduceRestoreTriggerFiring(
  slices: SlicesChangedByCommands,
  command: RestoreTriggerFiringCommand,
  context: ReducerContext,
): ReducerOutcome {
  const firing = findFiring(slices, command.firingId);
  if (firing === undefined) {
    return { status: 'refused', error: refuseUnknownFiring() };
  }
  if (firing.status !== 'dismissed') {
    return { status: 'refused', error: refuseFiringNotDismissed(firing.triggerName) };
  }
  const nowMs = Date.parse(context.now);
  const triggerActivity = changeStatusOfFiring(
    slices.triggerActivity,
    firing.firingId,
    'pending',
    nowMs,
  );
  return { status: 'applied', slices: { ...slices, triggerActivity } };
}
