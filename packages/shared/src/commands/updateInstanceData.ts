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
   * so nothing about the fields themselves is checked here. A top-level field sent as
   * `null` is taken off the instance's data (the way an optional field leaves the air);
   * the result is still checked, so removing a required field is refused.
   */
  data: z.record(z.string(), z.unknown()),
  /**
   * The fields the server writes itself, with the moment of this command in wall-clock
   * milliseconds, before the result is checked; a field named here need not be in
   * `data`. It exists so that a client never reads its own clock to re-reference a race
   * clock. Leaving it out means no field is stamped.
   */
  takeTimeFieldKeys: z.array(z.string().min(1)).default([]),
});

/** An updateInstanceData command after validation (takeTimeFieldKeys filled in). */
export type UpdateInstanceDataCommand = z.infer<typeof UpdateInstanceDataCommandSchema>;
