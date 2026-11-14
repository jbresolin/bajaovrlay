/**
 * Item editor: "Salvar e disparar" and "Salvar e prévia" (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-37 everything on air comes from an item, so a graphic made on the
 *   spot is made as an item and fired from the editor itself. Beside "Salvar item" the
 *   editor offers "Salvar e disparar" and "Salvar e prévia", for a new item and for a
 *   stored one. The save goes first; only once the server accepted it does the editor
 *   send `takeItem` (or `previewItem`, asked for by hand) for that item. A new item's id
 *   is made by the server, which names it in its answer to `createItem`.
 *
 * What these tests prove:
 *   - A new item: createItem first, then, after the answer naming the new item,
 *     takeItem (or previewItem with origin manual) for that id; the editor asks to be
 *     closed once both were accepted.
 *   - A stored item: updateItemFields with what changed, then takeItem (or previewItem with
 *     origin manual) for the item's own id; untouched, only takeItem is sent.
 *   - A refused save sends no take.
 *   - A refused take never undoes the save: for a stored item the editor stays open with
 *     the server's message; for a new item the editor turns into the editor of the item
 *     just saved ("Editar item", "Item salvo"), showing the message, and nothing is
 *     deleted.
 *
 * What these tests deliberately do not cover:
 *   - What createItem and updateItemFields carry: ItemEditorPanel.test.tsx and
 *     ItemEditorPanelEditing.test.tsx.
 *   - "Atualizar no ar": ItemEditorPanelUpdateOnAir.test.tsx.
 *   - The server's answer naming the item: apps/server's webSocketHub.test.ts.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RundownPanel } from '@/features/rundown/RundownPanel';
import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import {
  chooseGraphicInTheEditor,
  raceClockGraphicName,
  renderItemEditorPanelForNewRaceClockItem,
  renderItemEditorPanelOnFakeServerWithSlices,
  waitForCommandsReceived,
  waitForThePageToDealWithTheLastAnswer,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildEnduranceStartClockItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from './itemsLikeTheEditorSaves.testSupport';

/** The id the server gives the item the operator creates in these tests. */
const idOfTheItemTheServerCreates = '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c';

/** Fills the two fields a new race clock item needs: its label and its title on screen. */
function fillTheSafetyCarClockItem(): void {
  typeIntoField('Rótulo', 'Relógio — safety car');
  typeIntoField('Título', 'Enduro de Resistência — Safety car');
}

/** Presses a button of the editor by its name. */
function pressEditorButton(buttonName: string): void {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
}

/** The editor's usual slices, with the stored start item in the rundown. */
function buildSlicesWithTheStoredStartItem() {
  return {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    items: [buildEnduranceStartClockItem()],
  };
}

describe('"Salvar e disparar" and "Salvar e prévia" for a new item', () => {
  const useOfTheNewItemScenarios = [
    // The usual case: a graphic made on the spot goes on air at once.
    {
      name: 'creates the item, then takes it by the id the server gave it',
      buttonName: 'Salvar e disparar',
      expectedUseCommand: { type: 'takeItem', itemId: idOfTheItemTheServerCreates },
    },
    // Nothing goes to air without being seen first: the same, onto the preview output.
    {
      name: 'creates the item, then previews it by the id the server gave it',
      buttonName: 'Salvar e prévia',
      expectedUseCommand: {
        type: 'previewItem',
        itemId: idOfTheItemTheServerCreates,
        origin: 'manual',
      },
    },
  ];

  it.each(useOfTheNewItemScenarios)('$name', async ({ buttonName, expectedUseCommand }) => {
    // Arrange: the editor for a new race clock item, filled in.
    const { fakeServer, onClose } = renderItemEditorPanelForNewRaceClockItem();
    fillTheSafetyCarClockItem();

    // Act: press this row's button; the server accepts the createItem naming the new
    // item, and then accepts the take (or preview).
    pressEditorButton(buttonName);
    await waitForCommandsReceived(1, fakeServer);
    fakeServer.acceptLastCommandNamingTheItemItCreated(idOfTheItemTheServerCreates);
    await waitForCommandsReceived(2, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the save, then the use of that very item; then the editor asks to close.
    const commandsReceived = fakeServer.listCommandsReceived();
    expect(commandsReceived[0], 'the save must go first').toMatchObject({
      type: 'createItem',
      label: 'Relógio — safety car',
    });
    expect(commandsReceived[1], 'then the item the server made must be used').toEqual(
      expectedUseCommand,
    );
    await waitFor(() => {
      expect(onClose, 'the editor must close once both were accepted').toHaveBeenCalledTimes(1);
    });
  });

  it('sends no take when the save is refused', async () => {
    // Arrange: the editor for a new race clock item, filled in, and "Salvar e disparar"
    // pressed.
    const { fakeServer, onClose } = renderItemEditorPanelForNewRaceClockItem();
    fillTheSafetyCarClockItem();
    pressEditorButton('Salvar e disparar');
    await waitForCommandsReceived(1, fakeServer);

    // Act: the server refuses the createItem.
    fakeServer.refuseLastCommand({
      code: 'LAYER_NOT_FOUND',
      message: 'A camada "clock" não existe.',
    });
    await waitForThePageToDealWithTheLastAnswer();

    // Assert: nothing was taken, the editor stays open and says why.
    expect(fakeServer.listCommandsReceived(), 'a refused save must not be followed').toHaveLength(
      1,
    );
    expect(onClose, 'the editor must stay open after a refused save').not.toHaveBeenCalled();
    expect(
      screen.getByText('A camada "clock" não existe.'),
      'the refusal must be shown',
    ).toBeVisible();
  });

  it('turns into the editor of the saved item, showing why, when the take is refused', async () => {
    // Arrange: the rundown column with the editor opened by "+ Item", the race clock
    // chosen by name, and the form filled in.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithTheRaceClockAndTheLowerThird(),
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Item' }));
    chooseGraphicInTheEditor(raceClockGraphicName);
    fillTheSafetyCarClockItem();
    pressEditorButton('Salvar e disparar');
    await waitForCommandsReceived(1, fakeServer);

    // Act: the server stores the item (and sends the items slice before its answer, as
    // the real server does), then refuses the take.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'items',
      slice: [
        {
          id: idOfTheItemTheServerCreates,
          home: { kind: 'rundown', rundownId: 'sessao-principal' },
          order: 0,
          graphicId: 'race-clock',
          layerId: 'clock',
          fields: {
            sessionName: { kind: 'literal', value: 'Enduro de Resistência — Safety car' },
          },
          label: 'Relógio — safety car',
          color: 'neutral',
          notes: '',
        },
      ],
    });
    fakeServer.acceptLastCommandNamingTheItemItCreated(idOfTheItemTheServerCreates);
    await waitForCommandsReceived(2, fakeServer);
    fakeServer.refuseLastCommand({
      code: 'INVALID_GRAPHIC_DATA',
      message: 'Dados inválidos para o gráfico "race-clock": falta o campo "running".',
    });

    // Assert: the editor now edits the stored item and shows the refusal; nothing deleted.
    // (The editor of the stored item is a new one, so its area is looked up afresh.)
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'Editor de item' })).getByRole('heading', {
          name: 'Editar item',
        }),
        'the editor must now be the editor of the item just saved',
      ).toBeVisible();
    });
    const editorArea = within(screen.getByRole('region', { name: 'Editor de item' }));
    expect(
      editorArea.getByText('Item salvo — vale para os próximos disparos'),
      'the operator must see that the item is saved',
    ).toBeVisible();
    expect(
      editorArea.getByText('Dados inválidos para o gráfico "race-clock": falta o campo "running".'),
      'the take’s refusal must be shown in the editor',
    ).toBeVisible();
    expect(
      fakeServer.listCommandsReceived().map((command) => (command as { type: string }).type),
      'a refused take must never undo the save',
    ).toEqual(['createItem', 'takeItem']);
  });
});

describe('"Salvar e disparar" for a stored item', () => {
  it('saves what changed, then takes the item by its own id', async () => {
    // Arrange: the editor on the stored start item, its label changed.
    const storedItem = buildEnduranceStartClockItem();
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServerWithSlices(
      storedItem,
      buildSlicesWithTheStoredStartItem(),
    );
    typeIntoField('Rótulo', 'Largada do enduro — 10h');

    // Act: "Salvar e disparar"; the server accepts the save, then the take.
    pressEditorButton('Salvar e disparar');
    await waitForCommandsReceived(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the save of the label, then the take of the item; then the editor closes.
    expect(fakeServer.listCommandsReceived(), 'the save must go before the take').toEqual([
      { type: 'updateItemFields', itemId: storedItem.id, label: 'Largada do enduro — 10h' },
      // The take says the page showed the item's layer empty (BAJAOVRLAY-69).
      { type: 'takeItem', itemId: storedItem.id, instanceIdSeenOnAir: null },
    ]);
    await waitFor(() => {
      expect(onClose, 'the editor must close once both were accepted').toHaveBeenCalledTimes(1);
    });
  });

  it('"Salvar e prévia" saves what changed, then previews the item by hand', async () => {
    // Arrange: the editor on the stored start item, its label changed.
    const storedItem = buildEnduranceStartClockItem();
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServerWithSlices(
      storedItem,
      buildSlicesWithTheStoredStartItem(),
    );
    typeIntoField('Rótulo', 'Largada do enduro — 10h');

    // Act: "Salvar e prévia"; the server accepts the save, then the preview.
    pressEditorButton('Salvar e prévia');
    await waitForCommandsReceived(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the save of the label, then a preview of the item asked for by hand.
    expect(fakeServer.listCommandsReceived(), 'the save must go before the preview').toEqual([
      { type: 'updateItemFields', itemId: storedItem.id, label: 'Largada do enduro — 10h' },
      { type: 'previewItem', itemId: storedItem.id, origin: 'manual' },
    ]);
    await waitFor(() => {
      expect(onClose, 'the editor must close once both were accepted').toHaveBeenCalledTimes(1);
    });
  });

  it('only takes the item when nothing was changed', async () => {
    // Arrange: the editor on the stored start item, untouched.
    const storedItem = buildEnduranceStartClockItem();
    const { fakeServer } = renderItemEditorPanelOnFakeServerWithSlices(
      storedItem,
      buildSlicesWithTheStoredStartItem(),
    );

    // Act: "Salvar e disparar".
    pressEditorButton('Salvar e disparar');
    await waitForCommandsReceived(1, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: nothing to save, so the take is the one command.
    expect(fakeServer.listCommandsReceived(), 'an untouched item must just be taken').toEqual([
      // The take says the page showed the item's layer empty (BAJAOVRLAY-69).
      { type: 'takeItem', itemId: storedItem.id, instanceIdSeenOnAir: null },
    ]);
  });

  it('stays open with the server’s message when the take is refused, the save kept', async () => {
    // Arrange: the editor on the stored start item, its label changed, the save accepted.
    const storedItem = buildEnduranceStartClockItem();
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServerWithSlices(
      storedItem,
      buildSlicesWithTheStoredStartItem(),
    );
    typeIntoField('Rótulo', 'Largada do enduro — 10h');
    pressEditorButton('Salvar e disparar');
    await waitForCommandsReceived(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);

    // Act: the server refuses the take.
    fakeServer.refuseLastCommand({
      code: 'LAYER_NOT_FOUND',
      message: 'A camada "clock" não existe.',
    });
    await waitForThePageToDealWithTheLastAnswer();

    // Assert: open, the message shown, and no command sent to undo the save.
    expect(onClose, 'the editor must stay open after a refused take').not.toHaveBeenCalled();
    expect(
      screen.getByText('A camada "clock" não existe.'),
      'the take’s refusal must be shown',
    ).toBeVisible();
    expect(
      fakeServer.listCommandsReceived(),
      'a refused take must never undo the save',
    ).toHaveLength(2);
  });
});
