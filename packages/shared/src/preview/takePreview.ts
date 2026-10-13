import { z } from 'zod';

/**
 * Sends what is on the preview output of one layer to the program output: the same
 * graphic, the same item and the same data the operator was looking at, as a new
 * instance, and the preview of that layer is emptied. The one thing that changes is a
 * field the preview had stamped with its own moment (a clock's reference moment): it
 * gets the moment of this command, so the clock starts at the take.
 */
export const TakePreviewCommandSchema = z.object({
  type: z.literal('takePreview'),
  layerId: z.string().min(1),
});

/** A takePreview command after validation. */
export type TakePreviewCommand = z.infer<typeof TakePreviewCommandSchema>;
