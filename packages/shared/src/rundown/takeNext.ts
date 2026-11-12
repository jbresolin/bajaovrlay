import { z } from 'zod';

import { InstanceIdSeenOnAirSchema } from '../consoles/whatTheConsoleSawOnAir.js';

/**
 * Puts the item under a rundown's cursor on air, exactly as takeItem would (the Space
 * key). Refused by the server when the cursor is on nothing.
 */
export const TakeNextCommandSchema = z.object({
  type: z.literal('takeNext'),
  rundownId: z.string().min(1),
  /**
   * From a console only (gate 2 of PR #64): the item the page showed under the cursor at the
   * press. The server takes at its own cursor; when that is another item now (another press
   * moved it), the press is refused with RUNDOWN_CURSOR_MOVED, since what the page saw on air
   * was about another item, maybe on another layer. Left out by the command API's take-next.
   */
  cursorItemIdSeen: z.string().min(1).optional(),
  /**
   * From a console only (BAJAOVRLAY-69): the instance it showed on the program output of the
   * layer of the item its cursor was on, or null for an empty layer, as on takeItem.
   */
  instanceIdSeenOnAir: InstanceIdSeenOnAirSchema.optional(),
});

/** A takeNext command after validation. */
export type TakeNextCommand = z.infer<typeof TakeNextCommandSchema>;
