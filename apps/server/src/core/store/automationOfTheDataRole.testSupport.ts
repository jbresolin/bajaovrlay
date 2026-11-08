// Shared by the two tables of what Dados may do to automations (BAJAOVRLAY-29, gate 2 of
// PR #51): one trigger, one rule and two macros, as the store would hold them, and the
// commands the page sends when it saves one.
import type { Command, EventRule, Macro, Trigger } from '@bajaovrlay/shared';

/** "Entrevista no box": takes the interviewee's lower third. */
export const interviewInTheBoxMacro: Macro = {
  id: 'macro-entrevista-no-box',
  label: 'Entrevista no box',
  color: 'info',
  steps: [{ kind: 'takeItem', itemId: 'item-entrevistado-no-box' }],
};

/** "Replay da pista": switches OBS to the replay scene. */
export const trackReplayMacro: Macro = {
  id: 'macro-replay-da-pista',
  label: 'Replay da pista',
  color: 'success',
  steps: [{ kind: 'obsScene', sceneName: 'Replay', target: 'program' }],
};

/** "Entrou no box": waits for OBS's "Box" scene and runs the interview macro, asking. */
export function buildBoxEnteredTrigger(changes: Partial<Trigger> = {}): Trigger {
  return {
    id: 'gatilho-entrou-no-box',
    name: 'Entrou no box',
    isEnabled: true,
    when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
    macroId: interviewInTheBoxMacro.id,
    mode: 'ask',
    minimumIntervalMs: 10_000,
    ...changes,
  };
}

/** The rule of "Volta mais rápida": shows the fastest-lap item for 8 s, asking. */
export function buildFastestLapRule(changes: Partial<EventRule> = {}): EventRule {
  return {
    kind: 'fastestLap',
    mode: 'ask',
    itemId: 'item-volta-mais-rapida',
    durationMs: 8000,
    maxAgeMs: 60_000,
    ...changes,
  };
}

/** The three slices the check reads, holding one trigger, one rule and the two macros. */
export function buildSlicesHolding(trigger: Trigger, rule: EventRule) {
  return {
    triggers: [trigger],
    eventRules: [rule],
    macros: [interviewInTheBoxMacro, trackReplayMacro],
  };
}

/** updateTrigger as TriggerEditor sends it: the whole trigger, with the row's changes. */
export function buildSaveOfTheWholeTrigger(trigger: Trigger, changes: Partial<Trigger>): Command {
  const { id, ...everythingButTheId } = { ...trigger, ...changes };
  return { type: 'updateTrigger', triggerId: id, ...everythingButTheId };
}

/** updateEventRule as EventRuleRow sends it: the whole rule, with the row's changes. */
export function buildSaveOfTheWholeRule(rule: EventRule, changes: Partial<EventRule>): Command {
  return { type: 'updateEventRule', ...rule, ...changes };
}
