import type { Layer } from '@bajaovrlay/shared';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';

import { listItemIdsInOrderAfterDrag } from '@/features/rundown/itemIdsInOrderAfterDrag';
import { useEscapeBelongsToTheDragWhileDragging } from '@/features/rundown/useEscapeBelongsToTheDragWhileDragging';
import { ptBR } from '@/i18n/ptBR';

import type { ItemChoiceForMacroStep } from './macroStepChoices';
import type { MacroStepDraft } from './macroStepDrafts';
import {
  buildMacroStepDragAnnouncements,
  macroStepDragInstructionsForScreenReaders,
} from './macroStepDragAnnouncements';
import { MacroStepRow } from './MacroStepRow';

// A press that moves less than this is a click, not the start of a drag (as in the rundown).
const pointerDistanceThatStartsADragInPixels = 4;

/** What the list needs: the rows, the choices for their pickers, and the row messages. */
export type MacroStepListProps = {
  drafts: MacroStepDraft[];
  itemChoices: ItemChoiceForMacroStep[];
  layers: Layer[];
  /** The scenes OBS lists now, for the scene steps' picker; empty without OBS. */
  obsSceneNames: string[];
  errorMessageByDraftId: Record<string, string>;
  /** Called with every row, in the new order or with one row changed or removed. */
  onDraftsChanged: (draftsNow: MacroStepDraft[]) => void;
};

/**
 * The steps of the macro editor, top to bottom, which can be put in a new order by
 * dragging a row's numbered handle with the mouse or from the keyboard (Space or Enter,
 * the arrows, Space or Enter), the rundown's pattern (RundownItemList.tsx) with its
 * pt-BR announcements. Unlike the rundown, the order belongs to the editor until "Salvar
 * macro", so a drop moves the row at once. While a row is held, Esc belongs to the drag
 * and never reaches the panic key.
 */
export function MacroStepList(props: MacroStepListProps) {
  const { drafts, itemChoices, layers, obsSceneNames, errorMessageByDraftId, onDraftsChanged } =
    props;
  const draftIdsInOrder = drafts.map((draft) => draft.draftId);

  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: pointerDistanceThatStartsADragInPixels },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [isDragActiveOrPending, setIsDragActiveOrPending] = useState(false);
  useEscapeBelongsToTheDragWhileDragging(isDragActiveOrPending);

  function handleDragEnd(dragEnd: DragEndEvent): void {
    setIsDragActiveOrPending(false);
    const draftIdsAfterTheDrag = listItemIdsInOrderAfterDrag(
      draftIdsInOrder,
      String(dragEnd.active.id),
      dragEnd.over === null ? null : String(dragEnd.over.id),
    );
    if (draftIdsAfterTheDrag === null) {
      return;
    }
    const draftsInNewOrder = draftIdsAfterTheDrag
      .map((draftId) => drafts.find((draft) => draft.draftId === draftId))
      .filter((draft) => draft !== undefined);
    onDraftsChanged(draftsInNewOrder);
  }

  function replaceDraft(changedDraft: MacroStepDraft): void {
    onDraftsChanged(
      drafts.map((draft) => (draft.draftId === changedDraft.draftId ? changedDraft : draft)),
    );
  }

  function removeDraft(draftIdToRemove: string): void {
    onDraftsChanged(drafts.filter((draft) => draft.draftId !== draftIdToRemove));
  }

  if (drafts.length === 0) {
    return <p className="text-sm text-muted-foreground">{ptBR.quickFire.macroEditor.noSteps}</p>;
  }
  return (
    <DndContext
      sensors={dragSensors}
      collisionDetection={closestCenter}
      onDragPending={() => setIsDragActiveOrPending(true)}
      onDragStart={() => setIsDragActiveOrPending(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setIsDragActiveOrPending(false)}
      onDragAbort={() => setIsDragActiveOrPending(false)}
      accessibility={{
        announcements: buildMacroStepDragAnnouncements(draftIdsInOrder),
        screenReaderInstructions: macroStepDragInstructionsForScreenReaders,
      }}
    >
      <SortableContext items={draftIdsInOrder} strategy={verticalListSortingStrategy}>
        <ol aria-label={ptBR.quickFire.macroEditor.stepListLabel} className="flex flex-col gap-2">
          {drafts.map((draft, position) => (
            <MacroStepRow
              key={draft.draftId}
              draft={draft}
              stepNumber={position + 1}
              itemChoices={itemChoices}
              layers={layers}
              obsSceneNames={obsSceneNames}
              errorMessage={errorMessageByDraftId[draft.draftId]}
              onDraftChanged={replaceDraft}
              onRemovePressed={() => removeDraft(draft.draftId)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
