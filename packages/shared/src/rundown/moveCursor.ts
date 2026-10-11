import { z } from 'zod';

/**
 * Moves a rundown's "next" cursor without putting anything on air. `itemId` is the
 * item the cursor goes to, or null to put it on nothing; it must always be written,
 * so a cursor is never emptied by a forgotten field.
 */
export const MoveCursorCommandSchema = z.object({
  type: z.literal('moveCursor'),
  rundownId: z.string().min(1),
  itemId: z.string().min(1).nullable(),
});

/** A moveCursor command after validation. */
export type MoveCursorCommand = z.infer<typeof MoveCursorCommandSchema>;
