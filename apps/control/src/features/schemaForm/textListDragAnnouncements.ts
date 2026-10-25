import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';

import { ptBR } from '@/i18n/ptBR';

const dragTexts = ptBR.textList.dragAndDrop;

/**
 * What a screen reader reads when the focus reaches a line's handle: how to drag with the
 * keyboard. dnd-kit's own sentence is in English, so the pt-BR one replaces it.
 */
export const textListDragInstructionsForScreenReaders: ScreenReaderInstructions = {
  draggable: dragTexts.keyboardInstructions,
};

/**
 * The sentences a screen reader hears while a line of a list of texts is dragged, in
 * pt-BR, naming lines by the item title and their number as the list was when the drag
 * started ("Mensagem 2"; dnd-kit speaks of them by id). The macro steps' pattern.
 */
export function buildTextListDragAnnouncements(
  itemLabel: string,
  lineIdsInOrder: string[],
): Announcements {
  // A line's number counted from 1; 0 only for a line removed in the middle of a drag.
  function findLineNumber(lineId: UniqueIdentifier): number {
    return lineIdsInOrder.indexOf(String(lineId)) + 1;
  }

  return {
    onDragStart: ({ active }) => dragTexts.pickedUp(itemLabel, findLineNumber(active.id)),
    onDragOver: ({ active, over }) => {
      if (over === null) {
        return dragTexts.movedOutsideTheList(itemLabel, findLineNumber(active.id));
      }
      if (over.id === active.id) {
        return dragTexts.overItsOwnPlace(itemLabel, findLineNumber(active.id));
      }
      return dragTexts.movedOver(itemLabel, findLineNumber(active.id), findLineNumber(over.id));
    },
    onDragEnd: ({ active, over }) => {
      const wasDroppedWhereItWas = over === null || over.id === active.id;
      if (wasDroppedWhereItWas) {
        return dragTexts.leftWhereItWas(itemLabel, findLineNumber(active.id));
      }
      return dragTexts.dropped(itemLabel, findLineNumber(active.id));
    },
    onDragCancel: ({ active }) => dragTexts.leftWhereItWas(itemLabel, findLineNumber(active.id)),
  };
}
