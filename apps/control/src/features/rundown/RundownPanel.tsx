import { listItemsOfRundownInOrder } from '@bajaovrlay/shared';

import { useTakeThenPreviewNextItem } from '@/features/autoPreview/useTakeThenPreviewNextItem';
import { ActionButton } from '@/features/connection/ActionButton';
import { ItemEditorPanel } from '@/features/items/ItemEditorPanel';
import { useItemEditorTarget } from '@/features/items/ItemEditorTargetProvider';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { AutoPreviewToggle } from './AutoPreviewToggle';
import { chooseEmptyCursorHint } from './emptyCursorHint';
import { RundownItemList } from './RundownItemList';
import { findRundownShownOnPage } from './rundownShownOnPage';
import { useMoveCursorByHand } from './useMoveCursorByHand';
import { useRundownKeyboardShortcuts } from './useRundownKeyboardShortcuts';

/**
 * The rundown column: the items prepared for the session in firing order, the cursor on
 * the next one, and the ways to fire, preview, reorder, edit, delete and add items and to
 * move the cursor. It only repeats the server's `rundowns` and `items` slices; every
 * button sends one command and the list changes when the server's next slice arrives, not
 * before. The one exception to "one command": while the switch "Prévia automática" is on,
 * moving the cursor by hand (useMoveCursorByHand.ts) and a take that moves the cursor on
 * (features/autoPreview/useTakeThenPreviewNextItem.ts) each send a second command that
 * previews the item the cursor is on afterwards. The switch is the page's, not this
 * panel's: it is read from the page's one store (features/autoPreview/).
 *
 * The page's one item editor is drawn here, at the top of the column, whichever part of
 * the page opened it: this panel's "+ Item" and "Editar", and the quick-fire strip's
 * "+ Atalho" and "Editar" (features/quickFire). What it is open for is the page's
 * (features/items/ItemEditorTargetProvider.tsx), so both can open it.
 */
export function RundownPanel() {
  const rundowns = useServerState((state) => state.rundowns);
  const items = useServerState((state) => state.items);
  const graphics = useServerState((state) => state.graphics);
  const layers = useServerState((state) => state.layers);
  const sendCommand = useSendCommand();
  const { itemEditorTarget, openItemEditorForNewItem, openItemEditorForItem, closeItemEditor } =
    useItemEditorTarget();

  // The first rundown the server lists; why, in rundownShownOnPage.ts.
  const rundown = findRundownShownOnPage(rundowns);
  const itemsInOrder = rundown === undefined ? [] : listItemsOfRundownInOrder(items, rundown.id);

  const moveCursorByHand = useMoveCursorByHand(rundown?.id);
  const sendTakeByThisOperator = useTakeThenPreviewNextItem();
  useRundownKeyboardShortcuts(rundown, itemsInOrder, moveCursorByHand, sendTakeByThisOperator);

  if (rundown === undefined) {
    return <p className="text-sm text-muted-foreground">{ptBR.rundown.noRundownOnServer}</p>;
  }
  const rundownId = rundown.id;

  // The item is looked up in the server's list on every draw, among every item (a
  // quick-fire button is edited here too). So if someone deletes it while the editor is
  // open, there is no item to hand the editor and the editor leaves the screen, instead
  // of saving changes to something that no longer exists.
  const itemBeingEdited =
    itemEditorTarget.kind === 'existingItem'
      ? items.find((item) => item.id === itemEditorTarget.itemId)
      : undefined;
  const isItemEditorOnScreen = itemEditorTarget.kind === 'newItem' || itemBeingEdited !== undefined;
  // Where a new item goes unless the operator picks another place: where "+ Item" or
  // "+ Atalho" was pressed. For a stored item it is not used.
  const homeForNewItem =
    itemEditorTarget.kind === 'newItem'
      ? itemEditorTarget.home
      : ({ kind: 'rundown', rundownId } as const);
  // With the cursor on nothing Space has nothing to take, which without a word on screen
  // looks like a keyboard that stopped working. The words depend on why it is on nothing.
  const emptyCursorHint = chooseEmptyCursorHint(rundown, itemsInOrder.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">{rundown.name}</h2>
        <ActionButton
          variant="outline"
          size="sm"
          onClick={() => openItemEditorForNewItem({ kind: 'rundown', rundownId })}
        >
          {ptBR.rundown.addItemButton}
        </ActionButton>
      </div>
      <AutoPreviewToggle />

      {/* Going from one item to another without closing needs nothing here: the editor
          starts a new form by itself whenever it is handed another item. */}
      {isItemEditorOnScreen ? (
        <ItemEditorPanel
          homeForNewItem={homeForNewItem}
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
          onTakePressed={(itemId) => sendTakeByThisOperator({ type: 'takeItem', itemId })}
          onPreviewPressed={(itemId) =>
            void sendCommand({ type: 'previewItem', itemId, origin: 'manual' })
          }
          onSetCursorPressed={moveCursorByHand}
          onEditPressed={openItemEditorForItem}
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
        commandTypes={[
          'takeItem',
          'takeNext',
          'previewItem',
          'moveCursor',
          'reorderItems',
          'deleteItem',
        ]}
      />
    </div>
  );
}
