import type { Trigger } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import { readMacroIdOfMacroRunnerActor } from '../../core/store/commandActors.js';
import type { SlicesChangedByCommands } from '../../core/store/reducers/reducerTypes.js';

/** Why a trigger may not fire now: a short name for code, and the pt-BR reason. */
export type ReasonNotToFire = {
  why:
    | 'disabled'
    | 'paused'
    | 'tooSoon'
    | 'stillOnAir'
    | 'causedByAMacro'
    | 'causedByATriggerStartedRun';
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
 * - for a schedule every N minutes, a layer its macro takes an item onto still has a graphic
 *   on program (below);
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

  const layerStillOnAir = findLayerOfTheMacroStillOnAir(slices, trigger);
  if (layerStillOnAir !== undefined) {
    return {
      why: 'stillOnAir',
      message: reasons.stillOnAir(trigger.name, layerStillOnAir.name),
    };
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
  // a chain of others.
  // It has no real cause today: a scene switch is the only thing a macro does that a
  // trigger can see, and rule 1 drops it first. It guards the trigger kinds a macro could
  // cause later (a macro step that records an inbox event or calls a URL, say), so adding
  // one cannot open a loop. Its test (triggerLoops.test.ts) sends the cause by hand.
  // Its lineage is short: the run is read from `macroRuns`, which says whether a trigger
  // started it, and only while the run is there. Once the run has ended its later effects
  // count as nobody's, so a slow effect that lands after the run ended is not dropped.
  const runOfTheCause = slices.macroRuns.find((run) => run.macroId === macroIdOfTheCause);
  if (runOfTheCause?.trigger !== undefined) {
    return { why: 'causedByATriggerStartedRun', message: reasons.causedByAMacro(trigger.name) };
  }
  return undefined;
}

/**
 * For a schedule every N minutes (BAJAOVRLAY-64), the first layer its macro takes an item
 * onto that has anything on the program output now; undefined for any other trigger, or
 * when every such layer is free. By layer, not by item: a copy of the roll item, or the roll
 * sent to air from its preview, keeps the layer as busy as the roll itself.
 * Deliberate: a firing over the plain sponsor roll still on air would take it again, and
 * the layer's out-then-in would cut the pass short and start it over, every N minutes
 * while it overruns. The other kinds keep firing over what is on air, as before: a scene
 * or an event means "now", and the operator chose that by setting the trigger.
 */
function findLayerOfTheMacroStillOnAir(
  slices: SlicesChangedByCommands,
  trigger: Trigger,
): { name: string } | undefined {
  const isInterval =
    trigger.when.kind === 'schedule' && trigger.when.moment.kind === 'everyMinutes';
  if (!isInterval) {
    return undefined;
  }
  const macro = slices.macros.find((candidate) => candidate.id === trigger.macroId);
  if (macro === undefined) {
    return undefined;
  }
  for (const step of macro.steps) {
    if (step.kind !== 'takeItem') {
      continue;
    }
    const item = slices.items.find((candidate) => candidate.id === step.itemId);
    if (item === undefined) {
      continue;
    }
    const isLayerBusy = slices.instances.some(
      (instance) => instance.target === 'program' && instance.layerId === item.layerId,
    );
    if (isLayerBusy) {
      const layer = slices.layers.find((candidate) => candidate.id === item.layerId);
      return { name: layer?.name ?? item.layerId };
    }
  }
  return undefined;
}
