import { z } from 'zod';

import { LayerSchema } from '../slices/layer.js';

/**
 * Adds a layer to an output. The page makes the id (as it does an entity's); the server
 * refuses an id already used, an output that does not exist, and a zIndex another layer
 * of that output already has.
 */
export const CreateLayerCommandSchema = z.object({
  type: z.literal('createLayer'),
  layerId: LayerSchema.shape.id,
  outputId: LayerSchema.shape.outputId,
  name: LayerSchema.shape.name,
  zIndex: LayerSchema.shape.zIndex,
  replacePolicy: LayerSchema.shape.replacePolicy,
  persistent: LayerSchema.shape.persistent,
});

/** A createLayer command after validation. */
export type CreateLayerCommand = z.infer<typeof CreateLayerCommandSchema>;
