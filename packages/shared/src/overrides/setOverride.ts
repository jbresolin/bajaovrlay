import { z } from 'zod';

import { checkOverrideKey, OverrideKeyFieldsSchema } from './overrideKey.js';

/** Says whether a value was given at all (null counts as one). */
function isValuePresent(value: unknown): boolean {
  return value !== undefined;
}

/**
 * Corrects one value of a source until it is cleared ("Corrigir valor…", "Corrigir valor
 * da fonte…"), replacing an earlier correction of the same key. Operators only. The
 * server stamps who and when (setBy, setAt), checks that the source exists and that the
 * value fits the canonical field, and refreshes every bound instance on air at once.
 */
export const SetOverrideCommandSchema = OverrideKeyFieldsSchema.extend({
  type: z.literal('setOverride'),
  /** The corrected value; checked against the canonical field by the server. */
  value: z.unknown().refine(isValuePresent, { message: 'a correction needs a value' }),
  /** Why, in the operator's own words; a blank reason is refused. */
  reason: z.string().trim().min(1),
}).superRefine((command, context) => checkOverrideKey(command, context));

/** A setOverride command after validation. */
export type SetOverrideCommand = z.infer<typeof SetOverrideCommandSchema>;
