import { z } from 'zod';

/**
 * Shows one item on the preview output: the server turns the item's field values into
 * data exactly as takeItem does and puts the item's graphic on the item's layer of the
 * preview output, in place of whatever was previewed on that layer. Nothing on the
 * program output changes and the rundown's cursor does not move.
 */
export const PreviewItemCommandSchema = z.object({
  type: z.literal('previewItem'),
  itemId: z.string().min(1),
});

/** A previewItem command after validation. */
export type PreviewItemCommand = z.infer<typeof PreviewItemCommandSchema>;
