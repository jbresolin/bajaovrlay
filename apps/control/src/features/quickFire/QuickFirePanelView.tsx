import {
  type CommandInput,
  listItemsOfQuickFirePanelInOrder,
  listItemsOfRundownInOrder,
  type QuickFirePanel,
} from '@bajaovrlay/shared';
import { useState } from 'react';

import { ActionButton } from '@/features/connection/ActionButton';
import { useItemEditorTarget } from '@/features/items/ItemEditorTargetProvider';
import { findGraphicNameOrItsId } from '@/features/rundown/graphicAndLayerNames';
import { findRundownShownOnPage } from '@/features/rundown/rundownShownOnPage';
import { ptBR } from '@/i18n/ptBR';
import { keyboardMap } from '@/keyboard/keyboardMap';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { PanelNameForm } from './PanelNameForm';
import { QuickFireItemButton } from './QuickFireItemButton';

/** What the panel needs: which panel, and the page's one way of sending a take. */
export type QuickFirePanelViewProps = {
  panel: QuickFirePanel;
  /** features/autoPreview/useTakeThenPreviewNextItem.ts, shared with the rest of the page. */
  sendTakeByThisOperator: (takeCommand: CommandInput) => void;
};

const texts = ptBR.quickFire;

/**
 * One quick-fire panel: a row of what can be done to the panel ("+ Atalho", "Renomear",
 * "Excluir painel") and its grid of buttons, or a hint while it has none. It only
 * repeats the server's slices; every button sends one command, and the grid changes when
 * the server's next slice arrives.
 *
 * "Excluir painel" sends at the first press, with no confirmation: the server refuses a
 * panel that still has buttons and the last panel, so a stray click can only ever delete
 * an empty panel, which loses nothing.
 */
export function QuickFirePanelView(props: QuickFirePanelViewProps) {
  const { panel, sendTakeByThisOperator } = props;
  const items = useServerState((state) => state.items);
  const graphics = useServerState((state) => state.graphics);
  const rundowns = useServerState((state) => state.rundowns);
  const sendCommand = useSendCommand();
  const { openItemEditorForNewItem, openItemEditorForItem } = useItemEditorTarget();
  const [isRenaming, setIsRenaming] = useState(false);

  const buttonsInOrder = listItemsOfQuickFirePanelInOrder(items, panel.id);
  const digitKeys = keyboardMap.fireQuickFireButton.keys;

  // "Mover para rundown" puts the item after the last item of the rundown on screen, so
  // it never jumps ahead of what is planned. With no rundown there is nowhere to go.
  function moveItemToTheEndOfTheRundown(itemId: string): void {
    const rundown = findRundownShownOnPage(rundowns);
    if (rundown === undefined) {
      return;
    }
    const numberOfItemsInRundown = listItemsOfRundownInOrder(items, rundown.id).length;
    void sendCommand({
      type: 'moveItemToHome',
      itemId,
      home: { kind: 'rundown', rundownId: rundown.id },
      order: numberOfItemsInRundown,
    });
  }

  function renamePanel(newName: string): void {
    setIsRenaming(false);
    void sendCommand({ type: 'renameQuickFirePanel', panelId: panel.id, name: newName });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <ActionButton
          size="xs"
          variant="outline"
          onClick={() => openItemEditorForNewItem({ kind: 'quickFire', panelId: panel.id })}
        >
          {texts.addItemToPanelButton}
        </ActionButton>
        <ActionButton size="xs" variant="ghost" onClick={() => setIsRenaming(true)}>
          {texts.renamePanelButton}
        </ActionButton>
        <ActionButton
          size="xs"
          variant="ghost"
          onClick={() => void sendCommand({ type: 'deleteQuickFirePanel', panelId: panel.id })}
        >
          {texts.deletePanelButton}
        </ActionButton>
      </div>

      {isRenaming ? (
        <PanelNameForm
          controlId="quick-fire-rename-panel"
          fieldLabel={texts.panelNameLabel}
          submitButtonText={texts.savePanelNameButton}
          initialName={panel.name}
          onNameSubmitted={renamePanel}
          onCancel={() => setIsRenaming(false)}
        />
      ) : null}

      {buttonsInOrder.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {texts.emptyPanel}
        </p>
      ) : (
        // As many 10rem (160 px) buttons per row as the column holds, each stretched to
        // share the row: five in the 896 px column of a 1920 px window, three at 1366 px. A
        // label is cut short past about 18 characters at that width, as it was at two a row.
        <ul
          aria-label={texts.buttonGridLabel(panel.name)}
          className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2"
        >
          {buttonsInOrder.map((item, position) => (
            <QuickFireItemButton
              key={item.id}
              item={item}
              graphicName={findGraphicNameOrItsId(graphics, item.graphicId)}
              digitKey={digitKeys[position] ?? null}
              onTakePressed={() => sendTakeByThisOperator({ type: 'takeItem', itemId: item.id })}
              onPreviewChosen={() =>
                void sendCommand({ type: 'previewItem', itemId: item.id, origin: 'manual' })
              }
              onEditChosen={() => openItemEditorForItem(item.id)}
              onMoveToRundownChosen={() => moveItemToTheEndOfTheRundown(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
