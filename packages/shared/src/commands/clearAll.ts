import { z } from 'zod';

/** The panic button: takes every instance off every layer and output. */
export const ClearAllCommandSchema = z.object({
  type: z.literal('clearAll'),
});

/** A clearAll command after validation. */
export type ClearAllCommand = z.infer<typeof ClearAllCommandSchema>;
