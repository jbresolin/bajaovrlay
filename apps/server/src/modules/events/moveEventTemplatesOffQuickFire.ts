import {
  isItemFilledByAnEvent,
  type Item,
  listEventTemplatesInOrder,
  listItemsOfQuickFirePanelInOrder,
  type QuickFirePanel,
} from '@bajaovrlay/shared';

import { eventsQuickFirePanelId } from './seedEventItems.js';

/**
 * The name the move below is recorded under in `seeds_done` (BAJAOVRLAY-63's table of
 * one-off seeds), so it runs once per database.
 */
export const eventTemplatesOffQuickFireSeedName = 'eventTemplatesOffQuickFire';

/** The panels and items after the move, and whether it changed anything. */
export type EventTemplatesMoveOutcome = {
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  /** False when no template was on any panel: nothing to write. */
  isAnythingMoved: boolean;
};

/**
 * Takes every event template (an item with an "Evento" field) off every quick-fire panel
 * and puts it in "Modelos de evento" (BAJAOVRLAY-67), after the templates already there,
 * keeping its id (the rules still name it) and, panel by panel, its order. Each panel it
 * leaves is renumbered from 0. The panel "Avisos", where the seeds put the templates, is
 * deleted only when nothing else is left on it and another panel remains: an item the
 * operator added there keeps its panel, and the page always has a panel to show.
 * Run once per database by the boot (loadEventInboxSlices.ts). Pure.
 */
export function moveEventTemplatesOffQuickFire(
  quickFirePanels: QuickFirePanel[],
  items: Item[],
): EventTemplatesMoveOutcome {
  const panelsInOrder = [...quickFirePanels].sort((first, second) => first.order - second.order);
  const templateIdsToMove: string[] = [];
  for (const panel of panelsInOrder) {
    for (const item of listItemsOfQuickFirePanelInOrder(items, panel.id)) {
      if (isItemFilledByAnEvent(item.fields)) {
        templateIdsToMove.push(item.id);
      }
    }
  }
  if (templateIdsToMove.length === 0) {
    return { quickFirePanels, items, isAnythingMoved: false };
  }

  const templatesAlreadyThere = listEventTemplatesInOrder(items).length;
  const itemsWithTheTemplatesMoved = items.map((item) => {
    const placeAmongTheMoved = templateIdsToMove.indexOf(item.id);
    if (placeAmongTheMoved === -1) {
      return item;
    }
    const movedItem: Item = {
      ...item,
      home: { kind: 'eventTemplates' },
      order: templatesAlreadyThere + placeAmongTheMoved,
    };
    return movedItem;
  });
  const itemsAfter = renumberEveryPanelFromZero(quickFirePanels, itemsWithTheTemplatesMoved);

  const isAvisosLeftEmpty =
    listItemsOfQuickFirePanelInOrder(itemsAfter, eventsQuickFirePanelId).length === 0;
  const isAnotherPanelThere = quickFirePanels.some(
    (panel) => panel.id !== eventsQuickFirePanelId,
  );
  const panelsAfter =
    isAvisosLeftEmpty && isAnotherPanelThere
      ? deleteAvisosAndRenumberThePanels(quickFirePanels)
      : quickFirePanels;
  return { quickFirePanels: panelsAfter, items: itemsAfter, isAnythingMoved: true };
}

/** The panels without "Avisos", numbered 0, 1, 2… in their order, as deleteQuickFirePanel leaves them. */
function deleteAvisosAndRenumberThePanels(quickFirePanels: QuickFirePanel[]): QuickFirePanel[] {
  return quickFirePanels
    .filter((panel) => panel.id !== eventsQuickFirePanelId)
    .sort((first, second) => first.order - second.order)
    .map((panel, position) => (panel.order === position ? panel : { ...panel, order: position }));
}

/** The items with every panel's buttons numbered 0, 1, 2… in their order, no gaps. */
function renumberEveryPanelFromZero(quickFirePanels: QuickFirePanel[], items: Item[]): Item[] {
  const newOrderByItemId = new Map<string, number>();
  for (const panel of quickFirePanels) {
    listItemsOfQuickFirePanelInOrder(items, panel.id).forEach((item, position) => {
      newOrderByItemId.set(item.id, position);
    });
  }
  return items.map((item) => {
    const newOrder = newOrderByItemId.get(item.id);
    return newOrder === undefined || newOrder === item.order ? item : { ...item, order: newOrder };
  });
}
