import { z } from 'zod';

import { checkOverrideKey, OverrideKeyFieldsSchema } from './overrideKey.js';

/**
 * Takes a correction away ("Remover correção"): the source's own value goes back on air
 * at once wherever it is bound. Operators only. Clearing a correction that is not there
 * is answered ok and leaves no trace.
 */
export const ClearOverrideCommandSchema = OverrideKeyFieldsSchema.extend({
  type: z.literal('clearOverride'),
}).superRefine((command, context) => checkOverrideKey(command, context));

/** A clearOverride command after validation. */
export type ClearOverrideCommand = z.infer<typeof ClearOverrideCommandSchema>;
