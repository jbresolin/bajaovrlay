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
   * From a console only (BAJAOVRLAY-69): the instance it showed on the program output of the
   * layer of the item its cursor was on, or null for an empty layer, as on takeItem.
   */
  instanceIdSeenOnAir: InstanceIdSeenOnAirSchema.optional(),
});

/** A takeNext command after validation. */
export type TakeNextCommand = z.infer<typeof TakeNextCommandSchema>;
