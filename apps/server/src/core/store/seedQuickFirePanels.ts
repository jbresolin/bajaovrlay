import type { QuickFirePanel } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/**
 * The one quick-fire panel seeded when the database has none: "Atalhos", first tab.
 * Its id is fixed and readable so it is the same on every machine (as the seeded
 * rundown's is), but clients must read it from the `quickFirePanels` slice and never
 * write it into their own code: the operator may rename it, and add other panels.
 */
export const seededQuickFirePanels: QuickFirePanel[] = [
  { id: 'atalhos', name: ptBR.seededQuickFirePanelName, order: 0 },
];
