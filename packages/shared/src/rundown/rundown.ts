import { z } from 'zod';

/**
 * A rundown is the ordered list of items of one session, with a cursor on the item
 * that goes on air next. The items themselves live in the `items` slice and point back
 * here with `rundownId`.
 */
export const RundownSchema = z.object({
  id: z.string().min(1),
  /** The name the operator sees, in pt-BR (the seeded one is "Sessão principal"). */
  name: z.string().min(1),
  /** Which session this rundown is for, as free text; empty until someone writes it. */
  sessionLabel: z.string(),
  /**
   * The id of the item that goes on air next, or null when there is none (an empty
   * rundown, or the last item was just taken). It must always be written: a rundown
   * that leaves it out is refused, so "no next item" is never said by accident.
   */
  cursorItemId: z.string().min(1).nullable(),
});

/** A rundown that has passed RundownSchema. */
export type Rundown = z.infer<typeof RundownSchema>;
