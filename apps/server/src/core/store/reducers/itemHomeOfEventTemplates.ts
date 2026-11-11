import {
  type CommandError,
  isItemFilledByAnEvent,
  type ItemFields,
  type ItemHome,
} from '@bajaovrlay/shared';

import { ptBR } from '../../messages/ptBR.js';

/**
 * The refusal for an item that would sit in the wrong home for what it is (BAJAOVRLAY-67),
 * or undefined when it fits: an event template (an item with an "Evento" field) never sits
 * on a quick-fire panel (TEMPLATE_NOT_ON_QUICK_FIRE), where it was a button refusing every
 * press; and only a template sits among "Modelos de evento" (ITEM_NOT_FILLED_BY_EVENT),
 * where nothing but an event could ever show it. A rundown takes either: the rundown
 * already refuses the take of a template at the cursor. Shared by createItem,
 * moveItemToHome and updateItemFields, the three commands that set a home or the fields.
 */
export function findRefusalOfItemInTheWrongHome(
  home: ItemHome,
  fields: ItemFields,
  itemLabel: string,
): CommandError | undefined {
  const isAnEventTemplate = isItemFilledByAnEvent(fields);
  if (home.kind === 'quickFire' && isAnEventTemplate) {
    return {
      code: 'TEMPLATE_NOT_ON_QUICK_FIRE',
      message: ptBR.eventErrors.templateNotOnQuickFire(itemLabel),
    };
  }
  if (home.kind === 'eventTemplates' && !isAnEventTemplate) {
    return {
      code: 'ITEM_NOT_FILLED_BY_EVENT',
      message: ptBR.eventErrors.itemNotFilledByEvent(itemLabel),
    };
  }
  return undefined;
}
