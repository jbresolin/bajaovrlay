import { z } from 'zod';

/**
 * Adds a quick-fire panel after the last one. The server gives it its id; it starts
 * with no items.
 */
export const CreateQuickFirePanelCommandSchema = z.object({
  type: z.literal('createQuickFirePanel'),
  name: z.string().min(1),
});

/** A createQuickFirePanel command after validation. */
export type CreateQuickFirePanelCommand = z.infer<typeof CreateQuickFirePanelCommandSchema>;
