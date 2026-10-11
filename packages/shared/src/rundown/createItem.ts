import { z } from 'zod';

import { AutoOutDelayMsSchema } from './autoOutDelay.js';
import { ItemFieldsSchema } from './fieldValue.js';
import { defaultItemColor, ItemColorSchema } from './itemColor.js';

/**
 * Adds a prepared item to a rundown. The server gives the item its id. Colour, notes
 * and auto-out are accepted here, not only in updateItemFields, so that the item
 * editor saves a new item with one command instead of a create followed by an update.
 */
export const CreateItemCommandSchema = z.object({
  type: z.literal('createItem'),
  rundownId: z.string().min(1),
  graphicId: z.string().min(1),
  layerId: z.string().min(1),
  fields: ItemFieldsSchema,
  label: z.string().min(1),
  /**
   * The position the new item takes, counted from 0; the items from there on move down
   * by one. Leaving it out puts the item at the end.
   */
  order: z.number().int().min(0).optional(),
  /** Leaving it out gives the item the neutral colour. */
  color: ItemColorSchema.default(defaultItemColor),
  /** Leaving it out gives the item no notes (an empty text). */
  notes: z.string().default(''),
  /** Leaving it out means the item stays on air until the operator clears it. */
  autoOutAfterMs: AutoOutDelayMsSchema.optional(),
});

/** A createItem command after validation (colour and notes filled in). */
export type CreateItemCommand = z.infer<typeof CreateItemCommandSchema>;
