import type { CommandInput, Graphic, Layer, Output } from '@bajaovrlay/shared';
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

import { listItemIdsInOrderAfterDrag } from '@/features/rundown/itemIdsInOrderAfterDrag';
import { ptBR } from '@/i18n/ptBR';

import {
  buildLayerDragAnnouncements,
  layerDragInstructionsForScreenReaders,
} from './layerDragAnnouncements';
import { OutputLayerRow } from './OutputLayerRow';

const texts = ptBR.outputs;

// A press that moves less than this is a click, not the start of a drag.
const pointerDistanceThatStartsADragInPixels = 4;

/** What the list needs: the output, its layers bottom to top, the graphics, and how to send. */
export type OutputLayerListProps = {
  output: Output;
  layersBottomToTop: Layer[];
  graphics: Graphic[];
  sendFromTheCard: (command: CommandInput) => Promise<boolean>;
};

/**
 * One output's layers, bottom to top as Camadas lists them, reordered by dragging a
 * row's handle with the mouse or from the keyboard, as the rundown's rows are. A drop
 * sends reorderLayers with every layer of the output in the new order; the rows stay in
 * the server's order until its next layers slice (the same deliberate choice as the
 * rundown: the page never shows an order the server refused).
 */
export function OutputLayerList(props: OutputLayerListProps) {
  const layerIdsBottomToTop = props.layersBottomToTop.map((layer) => layer.id);
  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: pointerDistanceThatStartsADragInPixels },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(dragEnd: DragEndEvent): void {
    const layerIdDroppedOnto = dragEnd.over === null ? null : String(dragEnd.over.id);
    const layerIdsInNewOrder = listItemIdsInOrderAfterDrag(
      layerIdsBottomToTop,
      String(dragEnd.active.id),
      layerIdDroppedOnto,
    );
    if (layerIdsInNewOrder === null) {
      return;
    }
    void props.sendFromTheCard({
      type: 'reorderLayers',
      outputId: props.output.outputId,
      orderedLayerIds: layerIdsInNewOrder,
    });
  }

  if (props.layersBottomToTop.length === 0) {
    return <p className="text-muted-foreground text-sm">{texts.noLayers}</p>;
  }
  return (
    <DndContext
      sensors={dragSensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: buildLayerDragAnnouncements(props.layersBottomToTop),
        screenReaderInstructions: layerDragInstructionsForScreenReaders,
      }}
    >
      <SortableContext items={layerIdsBottomToTop} strategy={verticalListSortingStrategy}>
        <ol aria-label={texts.layersListLabel(props.output.name)} className="flex flex-col gap-2">
          {props.layersBottomToTop.map((layer) => (
            <OutputLayerRow
              key={layer.id}
              layer={layer}
              numberOfGraphicsDefaultingToIt={
                props.graphics.filter((graphic) => graphic.defaultLayerId === layer.id).length
              }
              sendFromTheCard={props.sendFromTheCard}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
