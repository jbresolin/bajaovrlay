import { z } from 'zod';

/**
 * Removes a quick-fire panel. The server refuses a panel that still has items (move or
 * delete them first) and the last panel there is.
 */
export const DeleteQuickFirePanelCommandSchema = z.object({
  type: z.literal('deleteQuickFirePanel'),
  panelId: z.string().min(1),
});

/** A deleteQuickFirePanel command after validation. */
export type DeleteQuickFirePanelCommand = z.infer<typeof DeleteQuickFirePanelCommandSchema>;
