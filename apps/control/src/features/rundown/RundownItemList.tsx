import type { Graphic, Item, Layer } from '@bajaovrlay/shared';
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

import { findGraphicNameOrItsId, findLayerNameOrItsId } from './graphicAndLayerNames';
import { listItemIdsInOrderAfterDrag } from './itemIdsInOrderAfterDrag';
import type { MoveToShortcutsChoice } from './moveToShortcutsChoices';
import {
  buildRundownDragAnnouncements,
  rundownDragInstructionsForScreenReaders,
} from './rundownDragAnnouncements';
import { RundownItemRow } from './RundownItemRow';
import { useEscapeBelongsToTheDragWhileDragging } from './useEscapeBelongsToTheDragWhileDragging';

// A press that moves less than this is a click, not the start of a drag.
const pointerDistanceThatStartsADragInPixels = 4;

/** What the list needs: the rows to draw, and what to do for each thing the operator asks. */
export type RundownItemListProps = {
  /** The name read out for the list, for example "Itens de Sessão principal". */
  listLabel: string;
  /** The items of the rundown on screen, first to last, exactly as the server has them. */
  itemsInOrder: Item[];
  cursorItemId: string | null;
  graphics: Graphic[];
  layers: Layer[];
  onTakePressed: (itemId: string) => void;
  /** Called when a row's "Prévia" is pressed: show that item on the preview output. */
  onPreviewPressed: (itemId: string) => void;
  /** Called when a row's label is clicked: the operator wants the cursor on that row. */
  onSetCursorPressed: (itemId: string) => void;
  onEditPressed: (itemId: string) => void;
  /** Called once a row's "Excluir" was pressed twice within 3 seconds. */
  onDeleteConfirmed: (itemId: string) => void;
  /** The "Mover para atalhos" entries every row's "⋯" menu offers, in tab order. */
  moveToShortcutsChoices: MoveToShortcutsChoice[];
  /** Called when a row's "Mover para atalhos" is chosen, with the panel it names. */
  onMoveToShortcutsChosen: (itemId: string, panelId: string) => void;
  /** Called after a drop that changes the order, with EVERY item id in the new order. */
  onItemsReordered: (itemIdsInNewOrder: string[]) => void;
};

/**
 * The rows of the rundown, which can be reordered by dragging a row's handle with the
 * mouse or, from the keyboard, with Space/Enter and the arrow keys.
 *
 * Deliberate: the list keeps no order of its own. After a drop it only reports the new
 * order; the rows go back to where the server last had them and move when the server's
 * next `items` slice arrives (the server owns the truth). The price is a short jump back
 * and forth after each drop; the gain is that the page can never show an order the
 * server refused or that another operator changed in the meantime.
 */
export function RundownItemList(props: RundownItemListProps) {
  const { itemsInOrder, cursorItemId, graphics, layers } = props;
  const itemIdsInOrder = itemsInOrder.map((item) => item.id);

  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: pointerDistanceThatStartsADragInPixels },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // True from the moment a handle is pressed (a drag is "pending" until the mouse has
  // moved 4 px) until the row is dropped, the drag is cancelled, or the press ends
  // without ever becoming a drag. While it is true, Esc belongs to the drag and must not
  // reach the panic key. This is not the order of the rows, which stays the server's.
  const [isDragActiveOrPending, setIsDragActiveOrPending] = useState(false);
  useEscapeBelongsToTheDragWhileDragging(isDragActiveOrPending);

  function rememberADragIsActiveOrPending(): void {
    setIsDragActiveOrPending(true);
  }

  function rememberNoDragIsActiveOrPending(): void {
    setIsDragActiveOrPending(false);
  }

  function handleDragEnd(dragEnd: DragEndEvent): void {
    rememberNoDragIsActiveOrPending();
    const draggedItemId = String(dragEnd.active.id);
    const itemIdDroppedOnto = dragEnd.over === null ? null : String(dragEnd.over.id);
    const itemIdsInNewOrder = listItemIdsInOrderAfterDrag(
      itemIdsInOrder,
      draggedItemId,
      itemIdDroppedOnto,
    );
    if (itemIdsInNewOrder === null) {
      return;
    }
    props.onItemsReordered(itemIdsInNewOrder);
  }

  return (
    <DndContext
      sensors={dragSensors}
      collisionDetection={closestCenter}
      onDragPending={rememberADragIsActiveOrPending}
      onDragStart={rememberADragIsActiveOrPending}
      onDragEnd={handleDragEnd}
      onDragCancel={rememberNoDragIsActiveOrPending}
      onDragAbort={rememberNoDragIsActiveOrPending}
      accessibility={{
        announcements: buildRundownDragAnnouncements(itemsInOrder),
        screenReaderInstructions: rundownDragInstructionsForScreenReaders,
      }}
    >
      <SortableContext items={itemIdsInOrder} strategy={verticalListSortingStrategy}>
        <ol aria-label={props.listLabel} className="flex flex-col gap-2">
          {itemsInOrder.map((item) => (
            <RundownItemRow
              key={item.id}
              item={item}
              isAtCursor={item.id === cursorItemId}
              graphicName={findGraphicNameOrItsId(graphics, item.graphicId)}
              layerName={findLayerNameOrItsId(layers, item.layerId)}
              onTakePressed={() => props.onTakePressed(item.id)}
              onPreviewPressed={() => props.onPreviewPressed(item.id)}
              onSetCursorPressed={() => props.onSetCursorPressed(item.id)}
              onEditPressed={() => props.onEditPressed(item.id)}
              onDeleteConfirmed={() => props.onDeleteConfirmed(item.id)}
              moveToShortcutsChoices={props.moveToShortcutsChoices}
              onMoveToShortcutsChosen={(panelId) => props.onMoveToShortcutsChosen(item.id, panelId)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
