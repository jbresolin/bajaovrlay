import type { EventRule, UpdateEventRuleCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseUnknownItem } from '../../../core/store/rundownCommandRefusals.js';

/**
 * updateEventRule ("Regras"): changes what the command carries of one kind's rule (mode,
 * item, duration, max age; a null item or max age removes it), leaving the rest. The
 * command's schema already refused a Super Chat on auto and a manual rule on ignore.
 * Refused: an item that does not exist (ITEM_NOT_FOUND). Events already in the inbox keep
 * their status: a rule changed to auto does not queue the pending ones (the operator
 * decides those), and one changed to ask does not stop the queued ones.
 */
export function reduceUpdateEventRule(
  slices: SlicesChangedByCommands,
  command: UpdateEventRuleCommand,
): ReducerOutcome {
  if (command.itemId !== undefined && command.itemId !== null) {
    const itemId = command.itemId;
    const itemExists = slices.items.some((item) => item.id === itemId);
    if (!itemExists) {
      return { status: 'refused', error: refuseUnknownItem(itemId) };
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
