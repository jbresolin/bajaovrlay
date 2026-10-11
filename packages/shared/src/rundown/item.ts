import { z } from 'zod';

import { AutoOutDelayMsSchema } from './autoOutDelay.js';
import { ItemFieldsSchema } from './fieldValue.js';
import { ItemColorSchema } from './itemColor.js';

/**
 * An item is a prepared use of a graphic: which graphic, on which layer, with a value
 * for each field, set up before the session and put on air with one press. It lives in
 * one rundown, at the position `order`.
 */
export const ItemSchema = z.object({
  id: z.string().min(1),
  rundownId: z.string().min(1),
  /**
   * The item's position in its rundown, counted from 0. The server keeps the orders of
   * a rundown's items as 0, 1, 2, ... with no gaps and no repeats.
   */
  order: z.number().int().min(0),
  graphicId: z.string().min(1),
  layerId: z.string().min(1),
  fields: ItemFieldsSchema,
  /** Left out when the item stays on air until the operator clears it. */
  autoOutAfterMs: AutoOutDelayMsSchema.optional(),
  /** The name the operator reads in the rundown and on the layer panel, in pt-BR. */
  label: z.string().min(1),
  color: ItemColorSchema,
  /** Free text for the operator; an empty text means there are no notes. */
  notes: z.string(),
});

/** An item that has passed ItemSchema. */
export type Item = z.infer<typeof ItemSchema>;
