import { z } from 'zod';

import { LayerSchema } from '../slices/layer.js';

/**
 * Removes a layer. The server refuses it while anything is on it (on air, in preview or
 * marked "vai limpar") and while an item, a quick-fire button, a macro step or an event
 * rule names it, listing them. A graphic whose default layer it was falls back to the
 * fullscreen layer.
 */
export const DeleteLayerCommandSchema = z.object({
  type: z.literal('deleteLayer'),
  layerId: LayerSchema.shape.id,
});

/** A deleteLayer command after validation. */
export type DeleteLayerCommand = z.infer<typeof DeleteLayerCommandSchema>;
