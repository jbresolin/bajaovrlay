import type { Item } from '@bajaovrlay/shared';
import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';

import { ptBR } from '@/i18n/ptBR';

/**
 * What a screen reader reads when the focus reaches a "Mover" handle: how to drag with
 * the keyboard. dnd-kit's own sentence is in English, so the pt-BR one replaces it.
 */
export const rundownDragInstructionsForScreenReaders: ScreenReaderInstructions = {
  draggable: ptBR.rundown.dragAndDrop.keyboardInstructions,
};

/**
 * Builds the sentences a screen reader hears while a row of the rundown is dragged:
 * picked up, over another row, dropped, put back. dnd-kit speaks of rows by id; the
 * sentences use each item's label instead, looked up in `itemsOfRundown`.
 */
export function buildRundownDragAnnouncements(itemsOfRundown: Item[]): Announcements {
  // Falls back to the id for an item deleted by someone else in the middle of a drag.
  function findItemLabel(itemId: UniqueIdentifier): string {
    const item = itemsOfRundown.find((candidate) => candidate.id === itemId);
    return item?.label ?? String(itemId);
  }

  return {
    onDragStart: ({ active }) => ptBR.rundown.dragAndDrop.pickedUp(findItemLabel(active.id)),
    onDragOver: ({ active, over }) => {
      if (over === null) {
        return ptBR.rundown.dragAndDrop.movedOutsideTheList(findItemLabel(active.id));
      }
      if (over.id === active.id) {
        return ptBR.rundown.dragAndDrop.overItsOwnPlace(findItemLabel(active.id));
      }
      return ptBR.rundown.dragAndDrop.movedOver(findItemLabel(active.id), findItemLabel(over.id));
    },
    onDragEnd: ({ active, over }) => {
      // The same test RundownItemList uses to decide that there is nothing to send.
      const wasDroppedWhereItWas = over === null || over.id === active.id;
      if (wasDroppedWhereItWas) {
        return ptBR.rundown.dragAndDrop.leftWhereItWas(findItemLabel(active.id));
      }
      return ptBR.rundown.dragAndDrop.dropped(findItemLabel(active.id));
    },
    onDragCancel: ({ active }) => ptBR.rundown.dragAndDrop.leftWhereItWas(findItemLabel(active.id)),
  };
}
