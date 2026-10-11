import { z } from 'zod';

/**
 * What a renderer may say about an instance: `on-air` once its play finished, `failed`
 * when it could not be imported, loaded or played. The other instance statuses are the
 * server's to set, so a renderer reporting them is refused.
 */
export const ReportedInstanceStatusSchema = z.enum(['on-air', 'failed']);

/** One of ReportedInstanceStatusSchema's values. */
export type ReportedInstanceStatus = z.infer<typeof ReportedInstanceStatusSchema>;

/**
 * Records what the renderer saw happen to an instance. The server builds it from the
 * renderer's `instanceStatus` WebSocket message and runs it through the same code path
 * as every other command; only an actor with the renderer role may send it.
 */
export const ReportInstanceStatusCommandSchema = z.object({
  type: z.literal('reportInstanceStatus'),
  instanceId: z.string().min(1),
  status: ReportedInstanceStatusSchema,
  /**
   * What went wrong, in words, for the layer panel to show. It is written by code (an
   * error message), so it may be in English. Leave it out rather than sending it empty.
   */
  detail: z.string().min(1).optional(),
});

/** A reportInstanceStatus command after validation. */
export type ReportInstanceStatusCommand = z.infer<typeof ReportInstanceStatusCommandSchema>;
