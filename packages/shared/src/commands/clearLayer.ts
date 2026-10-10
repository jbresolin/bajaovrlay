import { z } from 'zod';

/** Takes everything on one layer off, on both outputs. */
export const ClearLayerCommandSchema = z.object({
  type: z.literal('clearLayer'),
  layerId: z.string().min(1),
});

/** A clearLayer command after validation. */
export type ClearLayerCommand = z.infer<typeof ClearLayerCommandSchema>;
