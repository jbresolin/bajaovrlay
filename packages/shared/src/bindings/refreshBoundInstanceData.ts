import { z } from 'zod';

/**
 * Writes the new values of an instance's live bound fields after its source's data
 * changed (concept §5.2): sent only by the server's own refresher, as the actor
 * `sistema:vinculos`, never by a page. It goes through updateInstanceData's steps (nulls,
 * the update rule, the no-change check, the schema), so the instance keeps its id and
 * the renderer updates the graphic in place; it never marks a field "alterado no ar",
 * because a source's update is not an operator's change.
 */
export const RefreshBoundInstanceDataCommandSchema = z.object({
  type: z.literal('refreshBoundInstanceData'),
  instanceId: z.string().min(1),
  /**
   * The live bound fields' values as the source gives them now, top-level keys only. A
   * field sent as `null` leaves the air: an optional field whose value the source no
   * longer has.
   */
  data: z.record(z.string(), z.unknown()),
});

/** A refreshBoundInstanceData command after validation. */
export type RefreshBoundInstanceDataCommand = z.infer<typeof RefreshBoundInstanceDataCommandSchema>;
