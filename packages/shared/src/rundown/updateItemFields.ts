import { z } from 'zod';

import { AutoOutDelayMsSchema } from './autoOutDelay.js';
import { ItemFieldsSchema } from './fieldValue.js';
import { ItemColorSchema } from './itemColor.js';

/**
 * Changes parts of an existing item. Every part except `itemId` is optional, and a
 * part left out is left as it is on the item.
 * The item's rundown, graphic and layer cannot be changed here, on purpose: a different
 * graphic means different fields, so that is a new item (delete and create).
 */
export const UpdateItemFieldsCommandSchema = z.object({
  type: z.literal('updateItemFields'),
  itemId: z.string().min(1),
  /**
   * Only the field values that change, by field key. The server merges them over the
   * item's fields key by key: a key named here is replaced, a key not named is kept.
   * What could go wrong: there is no way to remove a key with this command.
   */
  fields: ItemFieldsSchema.optional(),
  label: z.string().min(1).optional(),
  color: ItemColorSchema.optional(),
  notes: z.string().optional(),
  /**
   * A number sets the auto-out delay, `null` removes it (the item then stays on air
   * until cleared), and leaving it out keeps what the item has.
   */
  autoOutAfterMs: AutoOutDelayMsSchema.nullable().optional(),
});

/** An updateItemFields command after validation. */
export type UpdateItemFieldsCommand = z.infer<typeof UpdateItemFieldsCommandSchema>;
