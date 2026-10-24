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
 * pt-BR, naming lines by their number as the list was when the drag started (dnd-kit
 * speaks of them by id). The macro steps' pattern (macroStepDragAnnouncements.ts).
 */
export function buildTextListDragAnnouncements(lineIdsInOrder: string[]): Announcements {
  // A line's number counted from 1; 0 only for a line removed in the middle of a drag.
  function findLineNumber(lineId: UniqueIdentifier): number {
    return lineIdsInOrder.indexOf(String(lineId)) + 1;
  }

  return {
    onDragStart: ({ active }) => dragTexts.pickedUp(findLineNumber(active.id)),
    onDragOver: ({ active, over }) => {
      if (over === null) {
        return dragTexts.movedOutsideTheList(findLineNumber(active.id));
      }
      if (over.id === active.id) {
        return dragTexts.overItsOwnPlace(findLineNumber(active.id));
      }
      return dragTexts.movedOver(findLineNumber(active.id), findLineNumber(over.id));
    },
    onDragEnd: ({ active, over }) => {
      const wasDroppedWhereItWas = over === null || over.id === active.id;
      if (wasDroppedWhereItWas) {
        return dragTexts.leftWhereItWas(findLineNumber(active.id));
      }
      return dragTexts.dropped(findLineNumber(active.id));
    },
    onDragCancel: ({ active }) => dragTexts.leftWhereItWas(findLineNumber(active.id)),
  };
}
