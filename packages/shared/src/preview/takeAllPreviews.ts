import { z } from 'zod';

/**
 * "Tomar tudo": sends everything Prévia shows to the program output at once. Every
 * preview instance is taken as takePreview takes it, and every layer marked "will be
 * cleared" has its program output cleared, in one state change, so OBS never shows a
 * half-taken set. Refused, with nothing changed, when there is nothing to take or when
 * any one layer cannot be taken.
 */
export const TakeAllPreviewsCommandSchema = z.object({
  type: z.literal('takeAllPreviews'),
});

/** A takeAllPreviews command after validation. */
export type TakeAllPreviewsCommand = z.infer<typeof TakeAllPreviewsCommandSchema>;
