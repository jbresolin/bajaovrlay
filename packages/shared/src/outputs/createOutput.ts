import { z } from 'zod';

import { OutputIdSchema, OutputSchema } from './output.js';

/**
 * Adds an output after the last one, with no layers. The operator types its id, the
 * slug of its renderer address (/render/?output=pip), and the server refuses one already
 * used.
 */
export const CreateOutputCommandSchema = z.object({
  type: z.literal('createOutput'),
  outputId: OutputIdSchema,
  name: OutputSchema.shape.name,
});

/** A createOutput command after validation. */
export type CreateOutputCommand = z.infer<typeof CreateOutputCommandSchema>;
