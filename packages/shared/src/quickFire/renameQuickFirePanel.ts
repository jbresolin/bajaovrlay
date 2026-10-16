import { z } from 'zod';

/** Gives a quick-fire panel a new name; its id, position and items stay as they are. */
export const RenameQuickFirePanelCommandSchema = z.object({
  type: z.literal('renameQuickFirePanel'),
  panelId: z.string().min(1),
  name: z.string().min(1),
});

/** A renameQuickFirePanel command after validation. */
export type RenameQuickFirePanelCommand = z.infer<typeof RenameQuickFirePanelCommandSchema>;
