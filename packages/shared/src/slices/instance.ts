import { z } from 'zod';

/** Which output an instance is on: `program` is on air, `preview` is the rehearsal output. */
export const InstanceTargetSchema = z.enum(['program', 'preview']);

/** One of InstanceTargetSchema's values. */
export type InstanceTarget = z.infer<typeof InstanceTargetSchema>;

/**
 * Where an instance is in its life: `loading` until the renderer confirms it, `ready`,
 * `on-air` while shown, `stopping` while animating out.
 */
export const InstanceStatusSchema = z.enum(['loading', 'ready', 'on-air', 'stopping']);

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
  /** When the take happened, as an ISO 8601 timestamp. */
  takenAt: z.iso.datetime(),
});

/** An instance that has passed InstanceSchema. */
export type Instance = z.infer<typeof InstanceSchema>;
