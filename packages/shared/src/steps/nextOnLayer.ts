import { z } from 'zod';

/**
 * "Próximo" on a layer: moves the graphic on the layer's program output to its next OGraf
 * step (the podium's 3rd, 2nd, then 1st place; concept §2, "Next"). The renderer then
 * plays that step. Refused with NOTHING_ON_AIR_ON_LAYER when the layer's program is empty,
 * with NO_NEXT_STEP on a graphic of one step or on its last step, and with STEP_ALREADY_MOVED
 * when the graphic is no longer on `fromStep`. A preview is never stepped: Prévia shows how
 * the graphic comes in.
 */
export const NextOnLayerCommandSchema = z.object({
  type: z.literal('nextOnLayer'),
  layerId: z.string().min(1),
  /**
   * The step the operator saw when pressing (the instance's currentStep on the page). A
   * double press, or two operators pressing at once, would otherwise reveal two places: the
   * second press names a step the graphic has already left, and is refused (gate 2 of
   * PR #27). The event-log row keeps it, so the history says which step was left.
   */
  fromStep: z.number().int().min(0),
});

/** A nextOnLayer command after validation. */
export type NextOnLayerCommand = z.infer<typeof NextOnLayerCommandSchema>;
