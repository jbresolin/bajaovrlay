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

import { findGraphicNameOrItsId, findLayerNameOrItsId } from './graphicAndLayerNames';
import { listItemIdsInOrderAfterDrag } from './itemIdsInOrderAfterDrag';
import {
  buildRundownDragAnnouncements,
  rundownDragInstructionsForScreenReaders,
} from './rundownDragAnnouncements';
import { RundownItemRow } from './RundownItemRow';

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
  onEditPressed: (itemId: string) => void;
  onDeletePressed: (itemId: string) => void;
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

  function handleDragEnd(dragEnd: DragEndEvent): void {
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
      onDragEnd={handleDragEnd}
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
              onEditPressed={() => props.onEditPressed(item.id)}
              onDeletePressed={() => props.onDeletePressed(item.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
