import { z } from 'zod';

/**
 * Takes everything on one layer off, on both outputs. With `target: 'program'` it takes
 * off the program output only and keeps that layer's preview: the auto-out sends it so,
 * because an item leaving the air by itself must not break a set the operator prepared
 * in Prévia. Aiming it at preview is refused; stopPreview is the command for that.
 */
export const ClearLayerCommandSchema = z.object({
  type: z.literal('clearLayer'),
  layerId: z.string().min(1),
  target: z.literal('program').optional(),
});

/** A clearLayer command after validation. */
export type ClearLayerCommand = z.infer<typeof ClearLayerCommandSchema>;
