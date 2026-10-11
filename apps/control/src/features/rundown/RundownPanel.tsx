import { listItemsOfRundownInOrder } from '@bajaovrlay/shared';
import { useState } from 'react';

import { ActionButton } from '@/features/connection/ActionButton';
import { ItemEditorPanel } from '@/features/items/ItemEditorPanel';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { chooseEmptyCursorHint } from './emptyCursorHint';
import { RundownItemList } from './RundownItemList';
import { useRundownKeyboardShortcuts } from './useRundownKeyboardShortcuts';

/**
 * What the item editor is on screen for, if at all. This is the one thing the panel
 * remembers by itself; it is about the page (which box is open), not about the show.
 */
type ItemEditorTarget =
  { kind: 'closed' } | { kind: 'newItem' } | { kind: 'existingItem'; itemId: string };

/**
 * The rundown column: the items prepared for the session in firing order, the cursor on
 * the next one, and the ways to fire, reorder, edit, delete and add items and to move
 * the cursor. It only repeats the server's `rundowns` and `items` slices; every button
 * sends one command and the list changes when the server's next slice arrives, not before.
 */
export function RundownPanel() {
  const rundowns = useServerState((state) => state.rundowns);
  const items = useServerState((state) => state.items);
  const graphics = useServerState((state) => state.graphics);
  const layers = useServerState((state) => state.layers);
  const sendCommand = useSendCommand();
  const [itemEditorTarget, setItemEditorTarget] = useState<ItemEditorTarget>({ kind: 'closed' });

  // Deliberate: the page shows the first rundown the server lists. The server seeds
  // exactly one ("Sessão principal") and has no command that makes another, so there is
  // nothing to choose between yet; its id is read here, never written into the page.
  const rundown = rundowns[0];
  const itemsInOrder = rundown === undefined ? [] : listItemsOfRundownInOrder(items, rundown.id);

  useRundownKeyboardShortcuts(rundown, itemsInOrder);

  if (rundown === undefined) {
    return <p className="text-sm text-muted-foreground">{ptBR.rundown.noRundownOnServer}</p>;
  }
  const rundownId = rundown.id;

  // The item is looked up in the server's list on every draw. So if someone deletes it
  // while the editor is open, there is no item to hand the editor and the editor leaves
  // the screen, instead of saving changes to something that no longer exists.
  const itemBeingEdited =
    itemEditorTarget.kind === 'existingItem'
      ? itemsInOrder.find((item) => item.id === itemEditorTarget.itemId)
      : undefined;
  const isItemEditorOnScreen = itemEditorTarget.kind === 'newItem' || itemBeingEdited !== undefined;
  // With the cursor on nothing Space has nothing to take, which without a word on screen
  // looks like a keyboard that stopped working. The words depend on why it is on nothing.
  const emptyCursorHint = chooseEmptyCursorHint(rundown, itemsInOrder.length);

  function closeItemEditor(): void {
    setItemEditorTarget({ kind: 'closed' });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">{rundown.name}</h2>
        <ActionButton
          variant="outline"
          size="sm"
          onClick={() => setItemEditorTarget({ kind: 'newItem' })}
        >
          {ptBR.rundown.addItemButton}
        </ActionButton>
      </div>

      {/* Going from one item to another without closing needs nothing here: the editor
          starts a new form by itself whenever it is handed another item. */}
      {isItemEditorOnScreen ? (
        <ItemEditorPanel
          rundownId={rundownId}
          itemBeingEdited={itemBeingEdited ?? null}
          onClose={closeItemEditor}
        />
      ) : null}

      {itemsInOrder.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {ptBR.rundown.emptyRundown}
        </p>
      ) : (
        <RundownItemList
          listLabel={ptBR.rundown.itemListLabel(rundown.name)}
          itemsInOrder={itemsInOrder}
          cursorItemId={rundown.cursorItemId}
          graphics={graphics}
          layers={layers}
          onTakePressed={(itemId) => void sendCommand({ type: 'takeItem', itemId })}
          onSetCursorPressed={(itemId) =>
            void sendCommand({ type: 'moveCursor', rundownId, itemId })
          }
          onEditPressed={(itemId) => setItemEditorTarget({ kind: 'existingItem', itemId })}
          onDeleteConfirmed={(itemId) => void sendCommand({ type: 'deleteItem', itemId })}
          onItemsReordered={(itemIdsInNewOrder) =>
            void sendCommand({
              type: 'reorderItems',
              rundownId,
              orderedItemIds: itemIdsInNewOrder,
            })
          }
        />
      )}

      {emptyCursorHint === 'none' ? null : (
        <p role="status" className="text-sm text-muted-foreground">
          {emptyCursorHint === 'endOfRundown'
            ? ptBR.rundown.endOfRundownHint
            : ptBR.rundown.placeTheCursorHint}
        </p>
      )}

      <CommandErrorMessage
        commandTypes={['takeItem', 'takeNext', 'moveCursor', 'reorderItems', 'deleteItem']}
      />
    </div>
  );
}
