/**
 * The one check the page makes before offering a take (BAJAOVRLAY-44, gate 2 of PR #22): an
 * item whose fields read the event it shows goes on air only through its event, so no
 * button, key or macro of the page takes it by itself. "Prévia" stays, filled from a sample
 * event. The server refuses those takes anyway (ITEM_FILLED_BY_EVENT); this keeps the page
 * from offering them.
 */
import { isItemFilledByAnEvent, type Item } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/** True for an item the page must never take by itself. */
export function isItemTakenOnlyThroughAnEvent(item: Item): boolean {
  return isItemFilledByAnEvent(item.fields);
}

/** The tooltip of a take turned off for such an item, or undefined for any other item. */
export function findWhyTheTakeOfItemIsOff(item: Item): string | undefined {
  return isItemTakenOnlyThroughAnEvent(item) ? ptBR.events.takeOfTemplateItemOff : undefined;
}
