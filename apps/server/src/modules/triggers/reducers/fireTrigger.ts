import type { FireTriggerCommand, TriggerFiring } from '@bajaovrlay/shared';

import { startMacroRun } from '../../../core/store/reducers/macroRunStart.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseUnknownTrigger } from '../triggerRefusals.js';
import { findWhyTriggerMayNotFireNow } from '../whenATriggerMayFire.js';
import { addFiringToTheActivity } from './triggerActivityChanges.js';

/**
 * fireTrigger: one firing of a trigger, sent by the trigger service (`sistema:gatilhos`).
 * A trigger that may not fire now (off, paused, within its interval, or one of the two
 * rules against loops, whenATriggerMayFire.ts) hands back the same slices: nothing
 * changes, so the store writes no row and tells nobody, as for any command that changes
 * nothing. Otherwise the firing is recorded, which writes its one event-log row (the
 * command, naming the trigger and its data), and:
 * - `auto` starts the macro at once, through the one start every run takes
 *   (macroRunStart.ts), the trigger and its data on the run;
 * - `auto` whose start is refused (another macro is running, mostly) waits as `ask`
 *   instead, with the refusal's reason: never a queue (a macro run minutes late would put
 *   graphics on air nobody expects) and never a cancel (the macro running was chosen by
 *   someone too);
 * - `ask` waits for the operator in the Eventos tab.
 * Refused only for a trigger that does not exist (deleted between the event and this).
 */
export function reduceFireTrigger(
  slices: SlicesChangedByCommands,
  command: FireTriggerCommand,
  context: ReducerContext,
): ReducerOutcome {
  const trigger = slices.triggers.find((candidate) => candidate.id === command.triggerId);
  if (trigger === undefined) {
    return { status: 'refused', error: refuseUnknownTrigger(command.triggerId) };
  }
  const nowMs = Date.parse(context.now);
  const reasonNotToFire = findWhyTriggerMayNotFireNow(slices, trigger, nowMs, command.causedBy);
  if (reasonNotToFire !== undefined) {
    return { status: 'applied', slices };
  }

  const firingId = context.newTriggerFiringId;
  let slicesAfterTheStart = slices;
  let hasTheMacroStarted = false;
  let autoRunRefusal: string | null = null;
  if (trigger.mode === 'auto') {
    const start = startMacroRun(slices, trigger.macroId, context, {
      triggerId: trigger.id,
      firingId,
      data: command.data,
    });
    if (start.status === 'applied') {
      slicesAfterTheStart = start.slices;
      hasTheMacroStarted = true;
    } else {
      autoRunRefusal = start.error.message;
    }
  }
  const firing: TriggerFiring = {
    firingId,
    triggerId: trigger.id,
    triggerName: trigger.name,
    macroId: trigger.macroId,
    data: command.data,
    firedAtMs: nowMs,
    status: hasTheMacroStarted ? 'ran' : 'pending',
    statusChangedAtMs: nowMs,
    autoRunRefusal,
  };
  const triggerActivity = addFiringToTheActivity(slicesAfterTheStart.triggerActivity, firing);
  return { status: 'applied', slices: { ...slicesAfterTheStart, triggerActivity } };
}
