import { z } from 'zod';

import { InstanceTargetSchema } from '../slices/instance.js';

/**
 * Puts a graphic on a layer with the data it shows, replacing whatever that layer
 * shows on the same output. In M0 the control page sends the resolved data directly.
 */
export const TakeGraphicCommandSchema = z.object({
  type: z.literal('takeGraphic'),
  graphicId: z.string().min(1),
  layerId: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  /** Leaving it out means program: a take goes on air unless it says otherwise. */
  target: InstanceTargetSchema.default('program'),
});

/** A takeGraphic command after validation (target filled in). */
export type TakeGraphicCommand = z.infer<typeof TakeGraphicCommandSchema>;
