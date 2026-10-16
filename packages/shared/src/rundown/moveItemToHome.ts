import { z } from 'zod';

import { ItemHomeSchema } from './itemHome.js';

/**
 * Moves an item to a home (a rundown or a quick-fire panel) at a position there, such
 * as "Mover para rundown" on a panel button. The server renumbers the home it leaves
 * and the home it joins. Naming the item's own home with a new position moves it within
 * that home, which is how the buttons of a panel are put in a new order.
 */
export const MoveItemToHomeCommandSchema = z.object({
  type: z.literal('moveItemToHome'),
  itemId: z.string().min(1),
  home: ItemHomeSchema,
  /**
   * The position the item takes in its new home, counted from 0; the items from there
   * on move down by one. A position past the end puts the item at the end.
   */
  order: z.number().int().min(0),
});

/** A moveItemToHome command after validation. */
export type MoveItemToHomeCommand = z.infer<typeof MoveItemToHomeCommandSchema>;
