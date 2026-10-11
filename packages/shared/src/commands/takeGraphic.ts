import { z } from 'zod';

import { InstanceTargetSchema } from '../slices/instance.js';

/**
 * Puts a graphic on a layer with the data it shows, replacing whatever that layer
 * shows on the same output. The control page sends the data already resolved, except
 * for the fields it names in `takeTimeFieldKeys`, which the server fills in.
 */
export const TakeGraphicCommandSchema = z.object({
  type: z.literal('takeGraphic'),
  graphicId: z.string().min(1),
  layerId: z.string().min(1),
  /**
   * The fields the graphic shows. A top-level field sent as `null` means "this field is
   * cleared": the server leaves it out of the data, so a cleared optional field never
   * reaches the graphic as null.
   */
  data: z.record(z.string(), z.unknown()),
  /** Leaving it out means program: a take goes on air unless it says otherwise. */
  target: InstanceTargetSchema.default('program'),
  /**
   * The fields of `data` the server writes itself, with the moment of this command in
   * wall-clock milliseconds (the same moment as the instance's `takenAt`), before the
   * data is checked. It exists so that a client never reads its own clock to say when a
   * race clock started. Leaving it out means no field is stamped.
   */
  takeTimeFieldKeys: z.array(z.string().min(1)).default([]),
});

/** A takeGraphic command after validation (target and takeTimeFieldKeys filled in). */
export type TakeGraphicCommand = z.infer<typeof TakeGraphicCommandSchema>;
