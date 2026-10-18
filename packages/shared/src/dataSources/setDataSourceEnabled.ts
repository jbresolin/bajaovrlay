import { z } from 'zod';

/** Turns a source on (the server starts polling it) or off (the switch on its row). */
export const SetDataSourceEnabledCommandSchema = z.object({
  type: z.literal('setDataSourceEnabled'),
  sourceId: z.string().min(1),
  isEnabled: z.boolean(),
});

/** A setDataSourceEnabled command after validation. */
export type SetDataSourceEnabledCommand = z.infer<typeof SetDataSourceEnabledCommandSchema>;
