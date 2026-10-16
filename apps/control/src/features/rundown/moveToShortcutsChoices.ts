import type { QuickFirePanel } from '@bajaovrlay/shared';

import { listQuickFireTabsInOrder } from '@/features/quickFire/quickFireTabs';
import { ptBR } from '@/i18n/ptBR';

/** One "Mover para atalhos" entry of a rundown row's menu: the panel and its text. */
export type MoveToShortcutsChoice = {
  panelId: string;
  menuText: string;
};

/**
 * The "Mover para atalhos" entries of a rundown row's menu, in the order of the quick-fire
 * tabs (quickFireTabs.ts, so the menu and the strip can never disagree). With one panel the
 * entry is the action alone; with several, one entry per panel named with it.
 * Deliberate: a flat list of entries rather than a submenu, which is plainer to reach
 * with the keyboard and to read; a show has a handful of panels at most.
 */
export function listMoveToShortcutsChoices(panels: QuickFirePanel[]): MoveToShortcutsChoice[] {
  const panelsInTabOrder: QuickFirePanel[] = [];
  for (const tab of listQuickFireTabsInOrder(panels)) {
    const panelOfTab =
      tab.kind === 'panel' ? panels.find((panel) => panel.id === tab.panelId) : undefined;
    if (panelOfTab !== undefined) {
      panelsInTabOrder.push(panelOfTab);
    }
  }

  const isThereOnlyOnePanel = panelsInTabOrder.length === 1;
  return panelsInTabOrder.map((panel) => ({
    panelId: panel.id,
    menuText: isThereOnlyOnePanel
      ? ptBR.rundown.moveToShortcutsAction
      : ptBR.rundown.moveToShortcutsPanelAction(panel.name),
  }));
}
