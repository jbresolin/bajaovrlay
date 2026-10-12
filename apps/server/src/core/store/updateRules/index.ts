// Public surface of the update rules: what the rest of the store imports from here.

// Which rule a graphic's updates run through, read from its manifest, or why the rule
// the manifest names cannot be run.
export {
  chooseUpdateRuleOfGraphic,
  type UpdateRuleChoice,
  type UpdateRuleProblem,
} from './updateRuleOfGraphic.js';
// The shape of a rule, of the work it does and of what it hands back.
export type { ApplyUpdateRule, UpdateRule, UpdateRuleResult } from './updateRuleTypes.js';
