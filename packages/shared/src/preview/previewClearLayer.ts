import { z } from 'zod';

/**
 * "Prévia: limpar" on a Camadas row: marks one layer "will be cleared", so the Prévia
 * monitor shows that layer empty, as the screen will be after the take. Any preview on
 * that layer is thrown away. Nothing on program changes until takePreview of that layer
 * or takeAllPreviews, which then clear the layer's program output.
 */
export const PreviewClearLayerCommandSchema = z.object({
  type: z.literal('previewClearLayer'),
  layerId: z.string().min(1),
});

/** A previewClearLayer command after validation. */
export type PreviewClearLayerCommand = z.infer<typeof PreviewClearLayerCommandSchema>;
