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

/**
 * A button that stays on its panel but at another place after the move, both places
 * counted from 1 as fire-shortcut counts them.
 */
export type QuickFireButtonShifted = {
  panelId: string;
  panelName: string;
  itemId: string;
  itemLabel: string;
  placeBefore: number;
  placeAfter: number;
};

/** The panels and items after the move, whether it changed anything, and what shifted. */
export type EventTemplatesMoveOutcome = {
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  /** False when no template was on any panel: nothing to write. */
  isAnythingMoved: boolean;
  /** The buttons left at another place, in panel order, for the boot to warn about. */
  buttonsShifted: QuickFireButtonShifted[];
};

/**
 * Takes every event template (an item with an "Evento" field) off every quick-fire panel
 * and puts it in "Modelos de evento" (BAJAOVRLAY-67), after the templates already there,
 * keeping its id (the rules still name it) and, panel by panel, its order. Each panel it
 * leaves is renumbered from 0. The panel "Avisos", where the seeds put the templates, is
 * deleted only when nothing else is left on it and another panel remains: an item the
 * operator added there keeps its panel, and the page always has a panel to show.
 * What could go wrong: a pad fires a button by its place (fire-shortcut/<panel>/<n>), so a
 * button after a template now answers to the number before; the outcome lists every such
 * button for the boot to warn about (gate 2 of PR #58).
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
    return { quickFirePanels, items, isAnythingMoved: false, buttonsShifted: [] };
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
  const buttonsShifted = listButtonsShifted(panelsInOrder, items, itemsAfter);

  const isAvisosLeftEmpty =
    listItemsOfQuickFirePanelInOrder(itemsAfter, eventsQuickFirePanelId).length === 0;
  const isAnotherPanelThere = quickFirePanels.some((panel) => panel.id !== eventsQuickFirePanelId);
  const panelsAfter =
    isAvisosLeftEmpty && isAnotherPanelThere
      ? deleteAvisosAndRenumberThePanels(quickFirePanels)
      : quickFirePanels;
  return { quickFirePanels: panelsAfter, items: itemsAfter, isAnythingMoved: true, buttonsShifted };
}

/**
 * The buttons still on a panel after the move whose place there changed: those that sat
 * after a template. Places are counted from 1 in the panel's order, as a pad counts them.
 */
function listButtonsShifted(
  panelsInOrder: QuickFirePanel[],
  itemsBefore: Item[],
  itemsAfter: Item[],
): QuickFireButtonShifted[] {
  const buttonsShifted: QuickFireButtonShifted[] = [];
  for (const panel of panelsInOrder) {
    const idsBefore = listItemsOfQuickFirePanelInOrder(itemsBefore, panel.id).map(
      (item) => item.id,
    );
    const buttonsAfter = listItemsOfQuickFirePanelInOrder(itemsAfter, panel.id);
    buttonsAfter.forEach((button, positionAfter) => {
      const positionBefore = idsBefore.indexOf(button.id);
      if (positionBefore !== positionAfter) {
        buttonsShifted.push({
          panelId: panel.id,
          panelName: panel.name,
          itemId: button.id,
          itemLabel: button.label,
          placeBefore: positionBefore + 1,
          placeAfter: positionAfter + 1,
        });
      }
    });
  }
  return buttonsShifted;
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
