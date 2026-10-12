import { carryClockForwardRule } from './carryClockForward.js';
import type { UpdateRule } from './updateRuleTypes.js';

// Every update rule the server knows. A manifest chooses one by name in
// `v_baja.updateRule`; a rule is a named pure function, never an expression written in
// a manifest (architecture rule 5). To add a rule: write it in its own file beside this
// one, with its tests, and add it to this list with a comment.
const registeredUpdateRules: UpdateRule[] = [
  // Keeps a clock on air from jumping when an update stops, starts, turns or corrects it.
  carryClockForwardRule,
];

/** Returns the update rule with this name, or undefined when the server knows none. */
export function findUpdateRuleByName(ruleName: string): UpdateRule | undefined {
  return registeredUpdateRules.find((registeredRule) => registeredRule.name === ruleName);
}
