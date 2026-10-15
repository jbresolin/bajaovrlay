import {
  type CommandInput,
  type Item,
  listItemsOfQuickFirePanelInOrder,
  type Macro,
  type QuickFirePanel,
} from '@bajaovrlay/shared';

import { keyboardMap } from '@/keyboard/keyboardMap';

/** One tab of the quick-fire strip: a panel of item buttons, or the macros. */
export type QuickFireTab = { kind: 'panel'; panelId: string } | { kind: 'macros' };

/**
 * The tabs of the strip, left to right: one per panel in the panels' `order` (the server
 * keeps it 0, 1, 2, ...), then "Macros". Macros is last so that adding a panel never moves
 * the panels' tabs, and F1 stays the first panel.
 */
export function listQuickFireTabsInOrder(panels: QuickFirePanel[]): QuickFireTab[] {
  // Copied before sorting: the list in the store belongs to the store.
  const panelsInOrder = [...panels].sort(
    (onePanel, otherPanel) => onePanel.order - otherPanel.order,
  );
  const panelTabs: QuickFireTab[] = panelsInOrder.map((panel) => ({
    kind: 'panel',
    panelId: panel.id,
  }));
  return [...panelTabs, { kind: 'macros' }];
}

/** Answers whether two tabs are the same tab. */
export function isSameQuickFireTab(oneTab: QuickFireTab, otherTab: QuickFireTab): boolean {
  if (oneTab.kind === 'macros' || otherTab.kind === 'macros') {
    return oneTab.kind === otherTab.kind;
  }
  return oneTab.panelId === otherTab.panelId;
}

/**
 * The tab the strip shows: the one the operator chose while it still exists, otherwise
 * the first tab. A chosen panel goes away when anyone deletes it; the page then shows a
 * tab that exists instead of an empty space. `chosenTab` null means "nothing chosen yet".
 */
export function chooseTabShown(tabs: QuickFireTab[], chosenTab: QuickFireTab | null): QuickFireTab {
  const isChosenTabStillThere =
    chosenTab !== null && tabs.some((tab) => isSameQuickFireTab(tab, chosenTab));
  if (isChosenTabStillThere) {
    return chosenTab;
  }
  // There is always at least the Macros tab, so the first tab exists.
  return tabs[0] ?? { kind: 'macros' };
}

// The function keys in the order of the tabs they open, as the keyboard map lists them
// (F1 to F4). Widened to plain strings so any KeyboardEvent.key can be looked up.
const functionKeysInTabOrder: readonly string[] = keyboardMap.switchQuickFireTab.keys;

/**
 * The tab a function key opens: the n-th key of keyboardMap.switchQuickFireTab opens the
 * n-th tab, counting the Macros tab where it is drawn (last). Undefined for a key the
 * map does not list, or one past the last tab.
 */
export function findTabForFunctionKey(
  tabs: QuickFireTab[],
  functionKey: string,
): QuickFireTab | undefined {
  const tabPosition = functionKeysInTabOrder.indexOf(functionKey);
  if (tabPosition === -1) {
    return undefined;
  }
  return tabs[tabPosition];
}

/**
 * The function key that opens the tab at this position (0 is the first tab), from the
 * same list of the keyboard map; undefined for a tab past the map's last key.
 */
export function findFunctionKeyForTabPosition(tabPosition: number): string | undefined {
  return functionKeysInTabOrder[tabPosition];
}

/** What chooseCommandForDigitKey needs. */
export type DigitKeyPress = {
  tabShown: QuickFireTab;
  /** The KeyboardEvent.key of the digit, '1' to '9'. */
  digit: string;
  items: Item[];
  macros: Macro[];
};

/**
 * What a digit sends on the tab shown: on a panel, `takeItem` of the panel's button at
 * that position (1 is the first, by the buttons' order); on Macros, `runMacro` of the
 * macro at that position, in the order the server lists the macros (creation order).
 * Null when there is no button there. A panel's button never moves the rundown's
 * cursor: the server's rule, not this function's.
 */
export function chooseCommandForDigitKey(press: DigitKeyPress): CommandInput | null {
  const position = Number(press.digit) - 1;
  const isADigitFromOneToNine = Number.isInteger(position) && position >= 0 && position <= 8;
  if (!isADigitFromOneToNine) {
    return null;
  }

  if (press.tabShown.kind === 'macros') {
    const macro = press.macros[position];
    return macro === undefined ? null : { type: 'runMacro', macroId: macro.id };
  }
  const buttonsOfPanel = listItemsOfQuickFirePanelInOrder(press.items, press.tabShown.panelId);
  const item = buttonsOfPanel[position];
  return item === undefined ? null : { type: 'takeItem', itemId: item.id };
}
