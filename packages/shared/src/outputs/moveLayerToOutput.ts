import { z } from 'zod';

import { LayerSchema } from '../slices/layer.js';
import { OutputIdSchema } from './output.js';

/**
 * Moves a layer to another output, keeping its id, name and height. The server refuses
 * it while anything is on the layer (on air, in preview or marked "vai limpar"), and when
 * the other output already has a layer at that height.
 */
export const MoveLayerToOutputCommandSchema = z.object({
  type: z.literal('moveLayerToOutput'),
  layerId: LayerSchema.shape.id,
  outputId: OutputIdSchema,
});

/** A moveLayerToOutput command after validation. */
export type MoveLayerToOutputCommand = z.infer<typeof MoveLayerToOutputCommandSchema>;
