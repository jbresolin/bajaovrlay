import { z } from 'zod';

/** Which output an instance is on: `program` is on air, `preview` is the rehearsal output. */
export const InstanceTargetSchema = z.enum(['program', 'preview']);

/** One of InstanceTargetSchema's values. */
export type InstanceTarget = z.infer<typeof InstanceTargetSchema>;

/**
 * Where an instance is in its life: `loading` until a renderer reports on it, `ready`,
 * `on-air` once a renderer says it is shown, `stopping` while animating out, and
 * `failed` when a renderer could not show it, even if another one already had. A failed
 * instance stays in the slice until its layer is cleared or taken again, so the operator
 * sees that it failed.
 */
export const InstanceStatusSchema = z.enum(['loading', 'ready', 'on-air', 'stopping', 'failed']);

/** One of InstanceStatusSchema's values. */
export type InstanceStatus = z.infer<typeof InstanceStatusSchema>;

/**
 * Who asked for a preview: `auto` is "Prévia automática" showing the item the cursor
 * arrived on, `manual` is the operator asking for it (a row's "Prévia", Shift+Space,
 * "Edição rápida").
 */
export const PreviewOriginSchema = z.enum(['auto', 'manual']);

/** One of PreviewOriginSchema's values. */
export type PreviewOrigin = z.infer<typeof PreviewOriginSchema>;

/**
 * An instance is one graphic taken on one layer of one output, with the resolved data
 * it shows. Graphics only ever receive `resolvedData`; they never fetch anything.
 */
export const InstanceSchema = z.object({
  id: z.string().min(1),
  layerId: z.string().min(1),
  graphicId: z.string().min(1),
  target: InstanceTargetSchema,
  resolvedData: z.record(z.string(), z.unknown()),
  /** The OGraf step the graphic is on; 0 is the first. */
  currentStep: z.number().int().min(0),
  status: InstanceStatusSchema,
  /**
   * What the renderer said about the status, for the layer panel: today, why the
   * instance failed. Absent when the renderer gave no detail. It comes from code (an
   * error message), so it may be in English.
   */
  statusDetail: z.string().min(1).optional(),
  /** When the take happened, as an ISO 8601 timestamp. */
  takenAt: z.iso.datetime(),
  /**
   * The item this instance was taken from, so the layer panel can show the item's
   * label. Left out for a take made by hand (takeGraphic). The item may have been
   * deleted since: an instance stays on air when its item goes away.
   */
  itemId: z.string().min(1).optional(),
  /**
   * Only on an instance of the preview output: the fields of `resolvedData` the server
   * stamped with the moment of the preview (a clock's reference moment). takePreview
   * writes the moment of the take over exactly these fields, so a previewed clock starts
   * counting when it goes on air. The server leaves it out when no field was stamped
   * (an empty list means the same), and the program instance a take creates never
   * carries it.
   * What could go wrong: an updateInstanceData that types a value into one of these
   * fields of a preview does not take the key off this list, so the take stamps over it.
   */
  takeTimeFieldKeys: z.array(z.string().min(1)).optional(),
  /**
   * Only on an instance of the preview output: who asked for this preview. The server
   * writes it on every preview it makes. The next previewItem with origin `auto` throws
   * away every other preview marked `auto`, so following the cursor never piles previews
   * up, and leaves the ones marked `manual`. The program instance a take creates never
   * carries it.
   * What could go wrong: a preview without the mark (none is written today) is not
   * `auto`, so nothing discards it by itself.
   */
  previewOrigin: PreviewOriginSchema.optional(),
});

/** An instance that has passed InstanceSchema. */
export type Instance = z.infer<typeof InstanceSchema>;
