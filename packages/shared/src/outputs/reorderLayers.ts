import { z } from 'zod';

import { LayerSchema } from '../slices/layer.js';
import { OutputIdSchema } from './output.js';

/**
 * Puts one output's layers in a new order, bottom to top: the drag on "Saídas e camadas".
 * The server hands the output's own zIndex values out again in that order, so the gaps
 * between them stay and no two layers ever share one. The list must hold every layer of
 * the output once.
 */
export const ReorderLayersCommandSchema = z.object({
  type: z.literal('reorderLayers'),
  outputId: OutputIdSchema,
  orderedLayerIds: z.array(LayerSchema.shape.id).min(1),
});

/** A reorderLayers command after validation. */
export type ReorderLayersCommand = z.infer<typeof ReorderLayersCommandSchema>;
