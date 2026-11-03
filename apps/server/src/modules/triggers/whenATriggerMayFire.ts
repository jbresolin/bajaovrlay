import type { Trigger } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import { readMacroIdOfMacroRunnerActor } from '../../core/store/commandActors.js';
import type { SlicesChangedByCommands } from '../../core/store/reducers/reducerTypes.js';

/** Why a trigger may not fire now: a short name for code, and the pt-BR reason. */
export type ReasonNotToFire = {
  why: 'disabled' | 'paused' | 'tooSoon' | 'causedByAMacro' | 'causedByATriggerStartedRun';
  message: string;
};

/**
 * Why this trigger may not fire now, or undefined when it may. fireTrigger's reducer asks
 * this before anything else (a firing it may not make changes nothing and leaves no row),
 * and the HTTP route asks it first to answer 409 with the reason. In this order:
 * - the trigger is off;
 * - "Pausar gatilhos" is on;
 * - its minimum interval has not passed since its last firing (the interval counts from
 *   the last firing, whatever became of it: a firing that asked counts too);
 * - the two rules against loops below, which read `causedBy`, the actor behind what
 *   happened.
 */
export function findWhyTriggerMayNotFireNow(
  slices: SlicesChangedByCommands,
  trigger: Trigger,
  nowMs: number,
  causedBy: string,
): ReasonNotToFire | undefined {
  const reasons = ptBR.triggers.notFiredReasons;
  if (!trigger.isEnabled) {
    return { why: 'disabled', message: reasons.disabled(trigger.name) };
  }
  if (slices.triggerActivity.isPaused) {
    return { why: 'paused', message: reasons.paused };
  }
  const lastFiredAtMs = slices.triggerActivity.lastFiredAtMsByTriggerId[trigger.id];
  const isWithinTheInterval =
    lastFiredAtMs !== undefined && nowMs - lastFiredAtMs < trigger.minimumIntervalMs;
  if (isWithinTheInterval) {
    const intervalSeconds = Math.round(trigger.minimumIntervalMs / 1000);
    return { why: 'tooSoon', message: reasons.tooSoon(trigger.name, intervalSeconds) };
  }

  const macroIdOfTheCause = readMacroIdOfMacroRunnerActor(causedBy);
  // Rule 1 against loops: a scene change made by a macro's own obsScene step fires no
  // obsScene trigger. A macro that switches to Box would otherwise run "Box entered" every
  // time, and "Box entered → go to Box" would loop. The change is told apart by the actor
  // of the switch that made it (the obs slice's `requestedBy`, matched to the change by
  // obsSceneChanges.ts), never by timing: a change the director makes in OBS a moment
  // after a macro's still fires. What could go wrong: a macro whose very purpose is to set
  // off a scene trigger cannot; it should run the other macro's steps itself.
  const isSceneChangeMadeByAMacro =
    trigger.when.kind === 'obsScene' && macroIdOfTheCause !== undefined;
  if (isSceneChangeMadeByAMacro) {
    return { why: 'causedByAMacro', message: reasons.causedByAMacro(trigger.name) };
  }
  // Rule 2 against loops: a trigger never fires from a macro that a trigger started.
  // Whatever such a run causes, of any kind, is dropped, so one trigger can never set off
  // a chain of others. Today a scene switch is the only thing a macro does that a trigger
  // can see, and rule 1 drops it first; this rule keeps the guarantee for any kind added
  // later. The run is read from `macroRuns`, which says whether a trigger started it; a
  // run that has already ended is no longer there, and its later effects count as nobody's.
  const runOfTheCause = slices.macroRuns.find((run) => run.macroId === macroIdOfTheCause);
  if (runOfTheCause?.trigger !== undefined) {
    return { why: 'causedByATriggerStartedRun', message: reasons.causedByAMacro(trigger.name) };
  }
  return undefined;
}
