import { z } from 'zod';

/**
 * Throws away what is on the preview output: of one layer, or of every layer. The
 * program output is never touched.
 */
export const StopPreviewCommandSchema = z.object({
  type: z.literal('stopPreview'),
  /**
   * The layer whose preview goes away, or `null` for every layer. It must always be
   * written. Deliberate: "every layer" is `null` and not a word such as "all", because a
   * layer may be given any id, that word included; and it may not be left out, because a
   * client bug that loses the layer id must not throw every preview away.
   */
  layerId: z.string().min(1).nullable(),
});

/** A stopPreview command after validation. */
export type StopPreviewCommand = z.infer<typeof StopPreviewCommandSchema>;
