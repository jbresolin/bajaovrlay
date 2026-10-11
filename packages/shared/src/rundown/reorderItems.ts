import { z } from 'zod';

/** Answers whether no id appears twice in the list. */
function hasNoRepeatedItemId(orderedItemIds: string[]): boolean {
  const distinctItemIds = new Set(orderedItemIds);
  return distinctItemIds.size === orderedItemIds.length;
}

/**
 * Puts a rundown's items in a new order. `orderedItemIds` is the full list of the
 * rundown's item ids, first to last, never only the items that moved.
 * This schema refuses what is wrong whatever the rundown holds: an empty id, or the
 * same id twice. Whether the list is exactly the rundown's items (none missing, none
 * from elsewhere) needs the state, so the server's reducer checks that and answers
 * ITEMS_NOT_A_PERMUTATION.
 */
export const ReorderItemsCommandSchema = z.object({
  type: z.literal('reorderItems'),
  rundownId: z.string().min(1),
  orderedItemIds: z.array(z.string().min(1)).refine(hasNoRepeatedItemId, {
    // The server answers in pt-BR from the field's path; this text is for logs and tests.
    message: 'orderedItemIds must not name the same item twice',
  }),
});

/** A reorderItems command after validation. */
export type ReorderItemsCommand = z.infer<typeof ReorderItemsCommandSchema>;
