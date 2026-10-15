import {
  type DeleteQuickFirePanelCommand,
  listItemsOfQuickFirePanelInOrder,
} from '@bajaovrlay/shared';

import {
  refuseDeleteOfLastPanel,
  refuseDeleteOfPanelWithItems,
  refuseUnknownQuickFirePanel,
} from '../quickFireAndMacroRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * deleteQuickFirePanel: removes an empty panel and moves the panels after it up by one,
 * so the positions stay 0, 1, 2, ... with no gap.
 * Refused, in this order, if the panel does not exist, if it still has items (deleting
 * it would delete items nobody chose to delete; move or delete them first), or if it is
 * the last panel left (the strip always has a tab, so a new item always has a home in a
 * panel; this is the conservative choice, for João to confirm).
 */
export function reduceDeleteQuickFirePanel(
  slices: SlicesChangedByCommands,
  command: DeleteQuickFirePanelCommand,
): ReducerOutcome {
  const panel = slices.quickFirePanels.find((candidate) => candidate.id === command.panelId);
  if (panel === undefined) {
    return { status: 'refused', error: refuseUnknownQuickFirePanel(command.panelId) };
  }
  const itemsOfThePanel = listItemsOfQuickFirePanelInOrder(slices.items, panel.id);
  if (itemsOfThePanel.length > 0) {
    return {
      status: 'refused',
      error: refuseDeleteOfPanelWithItems(panel.name, itemsOfThePanel.length),
    };
  }
  const isTheLastPanel = slices.quickFirePanels.length === 1;
  if (isTheLastPanel) {
    return { status: 'refused', error: refuseDeleteOfLastPanel(panel.name) };
  }

  const panelsKeptInOrder = slices.quickFirePanels
    .filter((candidate) => candidate.id !== panel.id)
    .sort((onePanel, otherPanel) => onePanel.order - otherPanel.order);
  const panelsAfter = panelsKeptInOrder.map((keptPanel, position) =>
    keptPanel.order === position ? keptPanel : { ...keptPanel, order: position },
  );
  return { status: 'applied', slices: { ...slices, quickFirePanels: panelsAfter } };
}
