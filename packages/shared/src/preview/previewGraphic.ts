import { z } from 'zod';

/**
 * Shows a graphic on the preview output of a layer with data typed by hand ("Edição
 * rápida"), in place of whatever was previewed on that layer. It is a takeGraphic that
 * can only go to the preview output: the same `data` and `takeTimeFieldKeys`, checked
 * the same way, and no `target` to get wrong.
 */
export const PreviewGraphicCommandSchema = z.object({
  type: z.literal('previewGraphic'),
  graphicId: z.string().min(1),
  layerId: z.string().min(1),
  /** The fields the graphic shows; a top-level `null` is a cleared field, as in takeGraphic. */
  data: z.record(z.string(), z.unknown()),
  /**
   * The fields the server writes itself with the moment of this command, as in
   * takeGraphic; leaving it out means none. The preview instance remembers these keys,
   * so a later takePreview writes the moment of the take over them: a previewed clock
   * starts counting when it goes on air, not when it was previewed.
   */
  takeTimeFieldKeys: z.array(z.string().min(1)).default([]),
});

/** A previewGraphic command after validation (takeTimeFieldKeys filled in). */
export type PreviewGraphicCommand = z.infer<typeof PreviewGraphicCommandSchema>;
