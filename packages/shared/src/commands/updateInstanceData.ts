import { z } from 'zod';

/**
 * Changes some of the data an instance shows without taking it off its layer: the
 * instance keeps its id, so the renderer updates the graphic in place instead of
 * animating it out and back in.
 */
export const UpdateInstanceDataCommandSchema = z.object({
  type: z.literal('updateInstanceData'),
  instanceId: z.string().min(1),
  /**
   * Only the fields that change. The server lays them over the instance's resolvedData
   * (top-level keys only) and checks the result against the graphic's manifest schema,
   * so nothing about the fields themselves is checked here.
   */
  data: z.record(z.string(), z.unknown()),
});

/** An updateInstanceData command after validation. */
export type UpdateInstanceDataCommand = z.infer<typeof UpdateInstanceDataCommandSchema>;
