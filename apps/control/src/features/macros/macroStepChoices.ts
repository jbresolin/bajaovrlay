import {
  type Item,
  listItemsOfQuickFirePanelInOrder,
  listItemsOfRundownInOrder,
  type QuickFirePanel,
  type Rundown,
} from '@bajaovrlay/shared';

import { isItemTakenOnlyThroughAnEvent } from '@/features/events/itemTakenThroughAnEvent';
import { ptBR } from '@/i18n/ptBR';

/** One item the step picker offers: its id and the words shown for it. */
export type ItemChoiceForMacroStep = { itemId: string; optionName: string };

/**
 * Every item a "Pôr item no ar" step may name, rundown or panel alike, in the order the
 * operator meets them on the page: each rundown's items in firing order, then each
 * panel's buttons in tab order. An item filled by an event is left out: it goes on air
 * only through its event, and the server refuses a run that takes it (gate 2 of PR #22). Each is shown by its label with its home in brackets
 * ("Logo Baja (Atalhos)"), because two items in different homes may share a label.
 */
export function listItemChoicesForMacroSteps(
  items: Item[],
  rundowns: Rundown[],
  panels: QuickFirePanel[],
): ItemChoiceForMacroStep[] {
  const itemOption = ptBR.quickFire.macroEditor.itemOption;
  const itemsAMacroMayTake = items.filter((item) => !isItemTakenOnlyThroughAnEvent(item));
  const choicesFromRundowns = rundowns.flatMap((rundown) =>
    listItemsOfRundownInOrder(itemsAMacroMayTake, rundown.id).map((item) => ({
      itemId: item.id,
      optionName: itemOption(item.label, rundown.name),
    })),
  );
  // Copied before sorting: the list in the store belongs to the store.
  const panelsInTabOrder = [...panels].sort(
    (onePanel, otherPanel) => onePanel.order - otherPanel.order,
  );
  const choicesFromPanels = panelsInTabOrder.flatMap((panel) =>
    listItemsOfQuickFirePanelInOrder(itemsAMacroMayTake, panel.id).map((item) => ({
      itemId: item.id,
      optionName: itemOption(item.label, panel.name),
    })),
  );
  return [...choicesFromRundowns, ...choicesFromPanels];
}
