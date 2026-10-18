import { z } from 'zod';

import { PollIntervalMsSchema } from './pollInterval.js';

/**
 * Changes a source's label, config or poll interval ("Editar"); only what it carries
 * changes. A config replaces the whole config and is checked by the server against the
 * schema of the source's kind. The kind itself never changes.
 */
export const UpdateDataSourceCommandSchema = z.object({
  type: z.literal('updateDataSource'),
  sourceId: z.string().min(1),
  label: z.string().min(1).optional(),
  config: z.unknown().optional(),
  pollIntervalMs: PollIntervalMsSchema.optional(),
});

/** An updateDataSource command after validation. */
export type UpdateDataSourceCommand = z.infer<typeof UpdateDataSourceCommandSchema>;
