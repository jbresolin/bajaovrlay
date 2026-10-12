import type { Graphic } from '@bajaovrlay/shared';

import { readSchemaPropertyOfGraphic } from '../graphicSchemaProperties.js';
import { findUpdateRuleByName } from './updateRuleRegistry.js';
import type { UpdateRule } from './updateRuleTypes.js';

/** Why the update rule a manifest names cannot be run. */
export type UpdateRuleProblem =
  /** The server knows no rule with that name (usually a typo in the manifest). */
  | { kind: 'unknownRule'; ruleName: string }
  /** The rule exists, but the graphic's data schema lacks fields the rule works on. */
  | { kind: 'schemaPropertiesMissing'; ruleName: string; missingPropertyKeys: string[] };

/**
 * What a graphic's manifest says about its updates: no rule, a rule that can be run, or
 * a rule that cannot be run and why.
 */
export type UpdateRuleChoice =
  | { status: 'noRule' }
  | { status: 'usable'; rule: UpdateRule }
  | { status: 'unusable'; problem: UpdateRuleProblem };

/**
 * Reads `v_baja.updateRule` from a graphic's manifest and answers which rule its
 * updates run through. The boot calls this to warn about a rule that cannot be run,
 * and updateInstanceData calls it on every update; both get the same answer, because
 * it depends on the manifest alone. Never throws.
 */
export function chooseUpdateRuleOfGraphic(graphic: Graphic): UpdateRuleChoice {
  const ruleName = graphic.manifest.v_baja?.updateRule;
  if (ruleName === undefined) {
    return { status: 'noRule' };
  }

  const rule = findUpdateRuleByName(ruleName);
  if (rule === undefined) {
    return { status: 'unusable', problem: { kind: 'unknownRule', ruleName } };
  }

  // A rule works on named fields. A graphic that names the rule without declaring them
  // (a copied manifest, a renamed field) would have the rule write fields its own
  // schema then refuses, or silently do nothing; saying so is clearer than either.
  const missingPropertyKeys = rule.schemaPropertiesNeeded.filter(
    (propertyKey) => readSchemaPropertyOfGraphic(graphic, propertyKey) === undefined,
  );
  if (missingPropertyKeys.length > 0) {
    return {
      status: 'unusable',
      problem: { kind: 'schemaPropertiesMissing', ruleName, missingPropertyKeys },
    };
  }

  return { status: 'usable', rule };
}
