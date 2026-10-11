import { z } from 'zod';

/**
 * Puts the item under a rundown's cursor on air, exactly as takeItem would (the Space
 * key). Refused by the server when the cursor is on nothing.
 */
export const TakeNextCommandSchema = z.object({
  type: z.literal('takeNext'),
  rundownId: z.string().min(1),
});

/** A takeNext command after validation. */
export type TakeNextCommand = z.infer<typeof TakeNextCommandSchema>;
