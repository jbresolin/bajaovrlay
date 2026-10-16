import { z } from 'zod';

import { AutoOutDelayMsSchema } from './autoOutDelay.js';
import { ItemFieldsSchema } from './fieldValue.js';
import { ItemColorSchema } from './itemColor.js';

/**
 * Changes parts of an existing item. Every part except `itemId` is optional, and a
 * part left out is left as it is on the item.
 * Deliberate: the name says "fields" although it also changes the label, colour, notes,
 * auto-out and, since BAJAOVRLAY-36, the layer; it was kept to avoid churn in every
 * client and in the event log.
 * The item's graphic cannot be changed here, on purpose: a different graphic means
 * different fields, so that is a new item. There is no `graphicId` in this schema, and a
 * `graphicId` sent anyway is dropped at validation, as every unknown key of a command
 * is. The home is changed by moveItemToHome, not here.
 */
export const UpdateItemFieldsCommandSchema = z.object({
  type: z.literal('updateItemFields'),
  itemId: z.string().min(1),
  /**
   * The layer the item goes to from its next take or preview on. A graphic already on
   * air from this item stays where it is. Left out keeps the item's layer.
   */
  layerId: z.string().min(1).optional(),
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
