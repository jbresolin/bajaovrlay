import { z } from 'zod';

import { InstanceIdSeenOnAirSchema } from '../consoles/whatTheConsoleSawOnAir.js';
import { TriggerFillOfTakeSchema } from '../triggers/triggerDataField.js';

/**
 * Puts one item on air: the server turns the item's field values into data, takes the
 * item's graphic on the item's layer, and moves the rundown's cursor to the item after
 * it. It always goes to the program output; `previewItem` (../preview/) is the same
 * resolution aimed at the preview output.
 */
export const TakeItemCommandSchema = z.object({
  type: z.literal('takeItem'),
  itemId: z.string().min(1),
  /**
   * Only from the macro runner (BAJAOVRLAY-48), for a take step with trigger fields: those
   * fields, filled from the run's trigger data instead of the item's values. The server's
   * authorisation refuses it from anyone else.
   */
  triggerFill: TriggerFillOfTakeSchema.optional(),
  /**
   * From a console only (BAJAOVRLAY-69): the instance it showed on the program output of the
   * item's layer at the press, or null for an empty layer (../consoles/). Left out by the
   * command API and a macro's step, which are never refused for what they did not see.
   */
  instanceIdSeenOnAir: InstanceIdSeenOnAirSchema.optional(),
});

/** A takeItem command after validation. */
export type TakeItemCommand = z.infer<typeof TakeItemCommandSchema>;
