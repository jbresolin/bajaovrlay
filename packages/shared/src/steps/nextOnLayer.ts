import { z } from 'zod';

/**
 * "Próximo" on a layer: moves the graphic on the layer's program output to its next OGraf
 * step (the podium's 3rd, 2nd, then 1st place; concept §2, "Next"). The renderer then
 * plays that step. Refused with NOTHING_ON_AIR_ON_LAYER when the layer's program is empty,
 * and with NO_NEXT_STEP on a graphic of one step or on its last step. A preview is never
 * stepped: Prévia shows how the graphic comes in.
 */
export const NextOnLayerCommandSchema = z.object({
  type: z.literal('nextOnLayer'),
  layerId: z.string().min(1),
});

/** A nextOnLayer command after validation. */
export type NextOnLayerCommand = z.infer<typeof NextOnLayerCommandSchema>;
