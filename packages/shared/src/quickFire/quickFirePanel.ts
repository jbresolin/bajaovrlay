import { z } from 'zod';

/**
 * A quick-fire panel: a named grid of buttons, one per item, for what the operator fires
 * ad hoc ("the ten things we do every hour"). Its items point at it through their home
 * (`{ kind: 'quickFire', panelId }`); the panel itself holds no list of items.
 */
export const QuickFirePanelSchema = z.object({
  id: z.string().min(1),
  /** The tab's name, in pt-BR (the seeded one is "Atalhos"). */
  name: z.string().min(1),
  /**
   * The panel's position among the panels, counted from 0: the order of the tabs. The
   * server keeps it as 0, 1, 2, ... with no gaps.
   */
  order: z.number().int().min(0),
});

/** A quick-fire panel that has passed QuickFirePanelSchema. */
export type QuickFirePanel = z.infer<typeof QuickFirePanelSchema>;
