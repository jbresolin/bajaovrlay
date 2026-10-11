import { z } from 'zod';

/** Removes an item from its rundown; the items after it move up by one. */
export const DeleteItemCommandSchema = z.object({
  type: z.literal('deleteItem'),
  itemId: z.string().min(1),
});

/** A deleteItem command after validation. */
export type DeleteItemCommand = z.infer<typeof DeleteItemCommandSchema>;
