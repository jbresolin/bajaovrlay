import { z } from 'zod';

import { OutputIdSchema } from './output.js';

/**
 * Puts the outputs in a new order, first to last. The list must hold every output once,
 * or the server refuses it, as reorderItems does a rundown's items.
 */
export const ReorderOutputsCommandSchema = z.object({
  type: z.literal('reorderOutputs'),
  orderedOutputIds: z.array(OutputIdSchema).min(1),
});

/** A reorderOutputs command after validation. */
export type ReorderOutputsCommand = z.infer<typeof ReorderOutputsCommandSchema>;
