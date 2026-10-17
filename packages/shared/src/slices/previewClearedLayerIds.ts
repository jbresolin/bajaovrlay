import { z } from 'zod';

/**
 * The `previewClearedLayerIds` slice: the layers marked "will be cleared" ("vai limpar").
 * Prévia shows exactly what the screen will look like after the take, so a marked layer
 * is drawn empty on the preview page even while something is on air there; takePreview
 * of that layer, or takeAllPreviews, then clears the layer's program output.
 * A layer is marked by previewClearLayer and by previewMacro, and unmarked by a preview on
 * that layer, stopPreview, a take of the preview, clearLayer and clearAll. A marked layer
 * never has a preview instance at the same time. Kept in the server's memory only, never
 * saved: after a restart it is empty, like the preview instances.
 */
export const PreviewClearedLayerIdsSchema = z.array(z.string().min(1));

/** The marked layers' ids, in the order they were marked. */
export type PreviewClearedLayerIds = z.infer<typeof PreviewClearedLayerIdsSchema>;
