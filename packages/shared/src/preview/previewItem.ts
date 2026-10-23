import { z } from 'zod';

import { PreviewOriginSchema } from '../slices/instance.js';

/**
 * Shows one item on the preview output: the server turns the item's field values into
 * data exactly as takeItem does and puts the item's graphic on the item's layer of the
 * preview output, in place of whatever was previewed on that layer. Nothing on the
 * program output changes and the rundown's cursor does not move.
 */
export const PreviewItemCommandSchema = z.object({
  type: z.literal('previewItem'),
  itemId: z.string().min(1),
  /**
   * Who asked: `manual` (a button or Shift+Space) or `auto` ("Prévia automática"
   * following the cursor). Leaving it out means `manual`. A preview with origin `auto`
   * first throws away every OTHER preview that was itself made with origin `auto`, on
   * any layer, so the preview output shows the item at the cursor and not the ones the
   * cursor passed; previews asked for by hand stay. The server marks the new preview
   * instance with this word (`previewOrigin`).
   */
  origin: PreviewOriginSchema.default('manual'),
  /**
   * Only for "Prévia" of an event in the inbox (BAJAOVRLAY-44): the event whose payload
   * fills the item's event fields. The preview carries the event's id, so "Tomar" shows
   * the event. Left out, an item filled by events is filled from a sample event.
   */
  eventId: z.string().min(1).optional(),
});

/** A previewItem command after validation (origin filled in). */
export type PreviewItemCommand = z.infer<typeof PreviewItemCommandSchema>;
