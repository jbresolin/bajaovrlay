import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';

import { ptBR } from '@/i18n/ptBR';

const dragTexts = ptBR.quickFire.macroEditor.dragAndDrop;

/**
 * What a screen reader reads when the focus reaches a step's handle: how to drag with the
 * keyboard. dnd-kit's own sentence is in English, so the pt-BR one replaces it.
 */
export const macroStepDragInstructionsForScreenReaders: ScreenReaderInstructions = {
  draggable: dragTexts.keyboardInstructions,
};

/**
 * The sentences a screen reader hears while a step is dragged, in pt-BR, naming steps by
 * their number in the list as it was when the drag started (dnd-kit speaks of them by
 * row id). The same pattern as the rundown's rundownDragAnnouncements.ts.
 */
export function buildMacroStepDragAnnouncements(draftIdsInOrder: string[]): Announcements {
  // A row's number counted from 1; 0 only for a row removed in the middle of a drag.
  function findStepNumber(draftId: UniqueIdentifier): number {
    return draftIdsInOrder.indexOf(String(draftId)) + 1;
  }

  return {
    onDragStart: ({ active }) => dragTexts.pickedUp(findStepNumber(active.id)),
    onDragOver: ({ active, over }) => {
      if (over === null) {
        return dragTexts.movedOutsideTheList(findStepNumber(active.id));
      }
      if (over.id === active.id) {
        return dragTexts.overItsOwnPlace(findStepNumber(active.id));
      }
      return dragTexts.movedOver(findStepNumber(active.id), findStepNumber(over.id));
    },
    onDragEnd: ({ active, over }) => {
      const wasDroppedWhereItWas = over === null || over.id === active.id;
      if (wasDroppedWhereItWas) {
        return dragTexts.leftWhereItWas(findStepNumber(active.id));
      }
      return dragTexts.dropped(findStepNumber(active.id));
    },
    onDragCancel: ({ active }) => dragTexts.leftWhereItWas(findStepNumber(active.id)),
  };
}
