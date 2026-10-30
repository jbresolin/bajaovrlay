import { z } from 'zod';

import { OutputIdSchema } from './output.js';

/**
 * Removes an output. The server refuses program, and an output that still has layers
 * (delete or move them first).
 */
export const DeleteOutputCommandSchema = z.object({
  type: z.literal('deleteOutput'),
  outputId: OutputIdSchema,
});

/** A deleteOutput command after validation. */
export type DeleteOutputCommand = z.infer<typeof DeleteOutputCommandSchema>;
