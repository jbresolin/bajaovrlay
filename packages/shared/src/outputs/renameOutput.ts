import { z } from 'zod';

import { OutputIdSchema, OutputSchema } from './output.js';

/**
 * Gives an output a new name. Its id stays, because an OBS scene holds it in its URL;
 * program may be renamed like any other.
 */
export const RenameOutputCommandSchema = z.object({
  type: z.literal('renameOutput'),
  outputId: OutputIdSchema,
  name: OutputSchema.shape.name,
});

/** A renameOutput command after validation. */
export type RenameOutputCommand = z.infer<typeof RenameOutputCommandSchema>;
