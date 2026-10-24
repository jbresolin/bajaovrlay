import type { QuickFirePanel } from '@bajaovrlay/shared';
import { cn } from 'cn';

import { ptBR } from '@/i18n/ptBR';

import {
  findFunctionKeyForTabPosition,
  isSameQuickFireTab,
  type QuickFireTab,
} from './quickFireTabs';

/** What the row of tabs needs. */
export type QuickFireTabListProps = {
  tabs: QuickFireTab[];
  tabShown: QuickFireTab;
  panels: QuickFirePanel[];
  onTabChosen: (tab: QuickFireTab) => void;
  /** The events waiting for the operator: the "Eventos" tab's badge (none at 0). */
  pendingEventCount: number;
  /** True for a few seconds after a new pending event arrived (usePendingEventAlert.ts). */
  isEventBadgePulsing: boolean;
};

/** The element ids that tie a tab to the area it shows. */
export const quickFireTabPanelId = 'quick-fire-tab-panel';
export function buildQuickFireTabId(tabPosition: number): string {
  return `quick-fire-tab-${tabPosition}`;
}

/**
 * The row of tabs: one per panel, "Macros" and "Eventos" (with the count of the events
 * waiting for the operator, pulsing when one arrives), each with the F-key that opens it written
 * small beside its name (only the tabs keyboardMap.ts lists a key for, the first four,
 * have one; quickFireTabs.ts reads it from there). A click shows that tab.
 *
 * Deliberate: plain buttons with the tab roles, not Radix Tabs. Radix moves between tabs
 * with the arrow keys and uses those presses up, so with the focus on a tab ← and →
 * would stop moving the rundown's cursor, which they do from any button
 * (docs/decisions.md, PR #8). The tabs are switched from the keyboard with F1–F4 instead.
 */
export function QuickFireTabList(props: QuickFireTabListProps) {
  const { tabs, tabShown, panels } = props;

  function findTabName(tab: QuickFireTab): string {
    if (tab.kind === 'macros') {
      return ptBR.quickFire.macrosTab;
    }
    if (tab.kind === 'events') {
      return ptBR.events.tabName;
    }
    return panels.find((panel) => panel.id === tab.panelId)?.name ?? tab.panelId;
  }

  return (
    <div role="tablist" aria-label={ptBR.quickFire.tabListLabel} className="flex flex-wrap gap-1">
      {tabs.map((tab, tabPosition) => {
        const isShown = isSameQuickFireTab(tab, tabShown);
        const functionKeyOfThisTab = findFunctionKeyForTabPosition(tabPosition);
        return (
          <button
            key={tab.kind === 'panel' ? tab.panelId : tab.kind}
            type="button"
            role="tab"
            id={buildQuickFireTabId(tabPosition)}
            aria-selected={isShown}
            aria-controls={quickFireTabPanelId}
            onClick={() => props.onTabChosen(tab)}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              isShown ? 'border-primary bg-accent font-semibold' : 'bg-background hover:bg-accent',
            )}
          >
            {findTabName(tab)}
            {tab.kind === 'events' && props.pendingEventCount > 0 ? (
              <span
                data-testid="pending-events-badge"
                data-pulsing={String(props.isEventBadgePulsing)}
                aria-label={ptBR.events.pendingBadgeLabel(props.pendingEventCount)}
                className={cn(
                  'rounded-full bg-destructive px-1.5 text-xs font-semibold text-white tabular-nums',
                  props.isEventBadgePulsing && 'animate-pulse',
                )}
              >
                {props.pendingEventCount}
              </span>
            ) : null}
            {functionKeyOfThisTab === undefined ? null : (
              <kbd aria-hidden="true" className="text-xs text-muted-foreground">
                {ptBR.quickFire.tabKey(functionKeyOfThisTab)}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
