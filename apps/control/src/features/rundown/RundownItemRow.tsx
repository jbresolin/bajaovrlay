import type { Item } from '@bajaovrlay/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

import { ItemColorChip } from './ItemColorChip';

/** What one row needs: its item, the names to show, and what each button does. */
export type RundownItemRowProps = {
  item: Item;
  /** true for the item at the rundown's cursor: the one Space puts on air. */
  isAtCursor: boolean;
  graphicName: string;
  layerName: string;
  onTakePressed: () => void;
  onEditPressed: () => void;
  onDeletePressed: () => void;
};

/**
 * One row of the rundown: a handle to drag it by, the item's colour and label, the
 * graphic and the layer it uses, and the buttons "Disparar", "Editar" and "Excluir".
 * The row at the cursor is marked for the eye (border and "Próximo") and for a screen
 * reader (`aria-current`). Must be drawn inside RundownItemList, which owns the dragging.
 */
export function RundownItemRow(props: RundownItemRowProps) {
  const { item, isAtCursor, graphicName, layerName } = props;
  const isConnected = useIsConnectedToServer();

  // dnd-kit's hook for one row of a sortable list. While this row is dragged, or makes
  // room for one that is, `transform` says how far to shift it on screen. That shift is
  // only visual: the order of the rows is always the server's.
  const {
    attributes: dragHandleAttributes,
    listeners: dragHandleListeners,
    setNodeRef: setRowElement,
    setActivatorNodeRef: setDragHandleElement,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    // A new order could not be sent without a connection, so the row cannot be dragged.
    disabled: !isConnected,
    attributes: { roleDescription: ptBR.rundown.dragAndDrop.handleRoleDescription },
  });
  const shiftWhileDragging = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setRowElement}
      style={shiftWhileDragging}
      aria-label={item.label}
      aria-current={isAtCursor ? 'true' : undefined}
      className={cn(
        'flex items-start gap-2 rounded-md border bg-card p-2',
        isAtCursor && 'border-primary bg-accent',
        isDragging && 'relative z-10 opacity-70 shadow-md',
      )}
    >
      {/* The handle is the only part that starts a drag, so a click on "Disparar" can
          never be taken for the start of one. `touch-none` lets a finger drag it on a
          tablet instead of scrolling the page. */}
      <button
        type="button"
        ref={setDragHandleElement}
        {...dragHandleAttributes}
        {...dragHandleListeners}
        disabled={!isConnected}
        aria-label={ptBR.rundown.moveItemHandle}
        className="mt-0.5 cursor-grab touch-none rounded-sm p-1 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <DragHandleIcon />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <ItemColorChip color={item.color} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
          {isAtCursor ? <Badge>{ptBR.rundown.nextItemBadge}</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{graphicName}</span>
          <Badge variant="outline">{layerName}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ActionButton size="xs" onClick={props.onTakePressed}>
            {ptBR.rundown.takeItemButton}
          </ActionButton>
          <ActionButton size="xs" variant="ghost" onClick={props.onEditPressed}>
            {ptBR.rundown.editItemButton}
          </ActionButton>
          <ActionButton size="xs" variant="ghost" onClick={props.onDeletePressed}>
            {ptBR.rundown.deleteItemButton}
          </ActionButton>
        </div>
      </div>
    </li>
  );
}

/**
 * Six dots in two columns, the usual sign for "drag here". Drawn inline, like the icons
 * of the shadcn Select, instead of adding an icon package (docs/decisions.md, PR #5).
 */
function DragHandleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </svg>
  );
}
