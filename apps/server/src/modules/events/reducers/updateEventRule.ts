import {
  type EventRule,
  isItemFilledByAnEvent,
  type UpdateEventRuleCommand,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseUnknownItem } from '../../../core/store/rundownCommandRefusals.js';

/**
 * updateEventRule ("Regras"): changes what the command carries of one kind's rule (mode,
 * item, duration, max age; a null item or max age removes it), leaving the rest. The
 * command's schema already refused a Super Chat on auto and a manual rule on ignore.
 * Refused: an item that does not exist (ITEM_NOT_FOUND), and one no event fills
 * (ITEM_NOT_FILLED_BY_EVENT): the tower picked by mistake would go on air in place of a
 * notice and leave after the rule's time (gate 2 of PR #22). Events already in the inbox keep
 * their status: a rule changed to auto does not queue the pending ones (the operator
 * decides those), and one changed to ask does not stop the queued ones.
 */
export function reduceUpdateEventRule(
  slices: SlicesChangedByCommands,
  command: UpdateEventRuleCommand,
): ReducerOutcome {
  if (command.itemId !== undefined && command.itemId !== null) {
    const itemId = command.itemId;
    const item = slices.items.find((candidate) => candidate.id === itemId);
    if (item === undefined) {
      return { status: 'refused', error: refuseUnknownItem(itemId) };
    }
    if (!isItemFilledByAnEvent(item.fields)) {
      return {
        status: 'refused',
        error: {
          code: 'ITEM_NOT_FILLED_BY_EVENT',
          message: ptBR.eventErrors.itemNotFilledByEvent(item.label),
        },
      };
    }
  }
  const rulesAfter = slices.eventRules.map((rule) =>
    rule.kind === command.kind ? applyChangesToRule(rule, command) : rule,
  );
  return { status: 'applied', slices: { ...slices, eventRules: rulesAfter } };
}

/** The rule with each field the command carries written over it. */
function applyChangesToRule(rule: EventRule, command: UpdateEventRuleCommand): EventRule {
  return {
    kind: rule.kind,
    mode: command.mode ?? rule.mode,
    itemId: command.itemId === undefined ? rule.itemId : command.itemId,
    durationMs: command.durationMs ?? rule.durationMs,
    maxAgeMs: command.maxAgeMs === undefined ? rule.maxAgeMs : command.maxAgeMs,
  };
}
