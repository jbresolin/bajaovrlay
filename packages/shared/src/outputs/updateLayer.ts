import { z } from 'zod';

import { LayerSchema } from '../slices/layer.js';

/**
 * Changes a layer's name, height, replace policy or persistence; only what it carries
 * changes. Allowed with a graphic on the layer: the renderer redraws its containers. The
 * server refuses a zIndex another layer of the same output already has. Moving a layer
 * to another output is moveLayerToOutput.
 */
export const UpdateLayerCommandSchema = z.object({
  type: z.literal('updateLayer'),
  layerId: LayerSchema.shape.id,
  name: LayerSchema.shape.name.optional(),
  zIndex: LayerSchema.shape.zIndex.optional(),
  replacePolicy: LayerSchema.shape.replacePolicy.optional(),
  persistent: LayerSchema.shape.persistent.optional(),
});

/** An updateLayer command after validation. */
export type UpdateLayerCommand = z.infer<typeof UpdateLayerCommandSchema>;
