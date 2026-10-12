/**
 * Item editor panel: "Atualizar no ar" when something is wrong (apps/control)
 *
 * What this module is for:
 *   "Atualizar no ar" sends two commands in a row: the save of the item, then the update
 *   of its instance on air. Either can be refused, a field can be badly typed, and the
 *   item can leave the air while the save is still waiting. The operator must always be
 *   told what happened, and what is on air must never get ahead of what the item stores.
 *
 * What these tests prove:
 *   - A wrong field shows its message and sends nothing at all.
 *   - When the save is refused, no on-air update is sent, the server's message is shown
 *     and the panel stays open.
 *   - When the save is accepted and the on-air update is refused, the server's message is
 *     shown next to the buttons and the panel stays open with the form as typed.
 *   - A second press after that sends only the on-air update again (the item is already
 *     saved), and the panel closes once it is accepted.
 *   - A field put back after that is saved again, with "Salvar item" or with "Atualizar
 *     no ar", so the item does not keep the value the operator gave up on; the air, which
 *     never changed, is sent nothing.
 *   - When the item leaves the air while the save is waiting, the on-air update is not
 *     sent and the panel asks to be closed: the item is saved and nothing is on air.
 *   - A refused on-air update the page remembers from elsewhere ("Edição rápida") is not
 *     shown by an editor that only saved.
 *
 * What these tests deliberately do not cover:
 *   - What a press sends when all goes well: ItemEditorPanelUpdateOnAir.test.tsx.
 *   - "Cancelar" or another item opened while the save is waiting:
 *     ItemEditorPanelClosedDuringAPress.test.tsx.
 *   - A save the server never answered: ItemEditorPanelUnansweredSave.test.tsx.
 *   - The server's reasons to refuse data (apps/server).
 *   - A command the server never answers (the 5-second timeout), which state/ tests
 *     cover for every command alike.
 */
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  pressButton,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  idOfTheInstanceTakenFromTheItem,
  type ItemEditorOnFakeServer,
  pressSaveAndWaitForCommand,
  pressUpdateOnAirAndWaitForCommand,
  renderItemEditorPanelForItemOnAir,
  waitForCommandsReceived,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildEnduranceStartClockItem,
  raceClockReferenceTimeLabel,
} from './itemsLikeTheEditorSaves.testSupport';

const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

const saveOfTheGreenFlag = {
  type: 'updateItemFields',
  itemId: idOfTheEnduranceStartItem,
  fields: { state: { kind: 'literal', value: 'green' } },
};
const onAirUpdateOfTheGreenFlag = {
  type: 'updateInstanceData',
  instanceId: idOfTheInstanceTakenFromTheItem,
  data: { state: 'green' },
  takeTimeFieldKeys: [],
};
const saveOfThePreStartFlagPutBack = {
  type: 'updateItemFields',
  itemId: idOfTheEnduranceStartItem,
  fields: { state: { kind: 'literal', value: 'pre' } },
};

/**
 * Draws the editor for the endurance start clock on air and plays a half-done "Atualizar
 * no ar": the green flag is chosen, its save is accepted and its on-air update is
 * refused. It returns once the buttons are back, with the panel still open.
 */
async function renderEditorWithGreenFlagSavedAndRefusedOnAir(): Promise<ItemEditorOnFakeServer> {
  const editorOnFakeServer = renderItemEditorPanelForItemOnAir(buildEnduranceStartClockItem());
  const { fakeServer } = editorOnFakeServer;
  chooseOptionInDropdown('Bandeira', 'Verde');
  await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
  fakeServer.acceptLastCommand();
  await waitForCommandsReceived(2, fakeServer);
  fakeServer.refuseLastCommand({
    code: 'INVALID_GRAPHIC_DATA',
    message: 'Os dados não são aceitos pelo gráfico "Relógio de prova".',
  });
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Atualizar no ar' }),
      'the button must come back before it can be pressed again',
    ).toBeEnabled();
  });
  return editorOnFakeServer;
}

describe('a press of "Atualizar no ar" when something is wrong', () => {
  it('shows the message of a wrong field and sends nothing', async () => {
    // Arrange: the endurance start clock on air, with one hour typed as h:mm:ss.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );
    typeIntoField(raceClockReferenceTimeLabel, '1:00:00');

    // Act: press "Atualizar no ar".
    pressButton('Atualizar no ar');

    // Assert: the field explains the format, and neither command was sent.
    expect(
      await screen.findByText(
        `Use minutos e segundos no formato mm:ss em "${raceClockReferenceTimeLabel}", por exemplo 12:30.`,
      ),
      'the badly typed time must be reported under its field',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'a form with a wrong field must send neither the save nor the on-air update',
    ).toEqual([]);
    expect(onClose, 'the panel must stay open so the time can be corrected').not.toHaveBeenCalled();
  });

  it('sends no on-air update when the save is refused, shows why and stays open', async () => {
    // Arrange: the clock on air, the green flag chosen, and the press on its way.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);

    // Act: the server refuses the save, because another operator deleted the item.
    fakeServer.refuseLastCommand({
      code: 'ITEM_NOT_FOUND',
      message: 'O item "0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90" não existe.',
    });

    // Assert: the refusal is shown, the buttons come back, and the air was never asked
    // to change: it must not show something the item does not store.
    expect(
      await screen.findByRole('alert'),
      "the panel must show the server's message for the refused save",
    ).toHaveTextContent('O item "0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90" não existe.');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atualizar no ar' }),
        'the button must come back once the server has answered',
      ).toBeEnabled();
    });
    expect(
      fakeServer.listCommandsReceived(),
      'after a refused save no on-air update may be sent',
    ).toEqual([saveOfTheGreenFlag]);
    expect(onClose, 'a refused save must not close the panel').not.toHaveBeenCalled();
  });

  it('stays open and shows why when the save is accepted and the on-air update is refused', async () => {
    // Arrange: the clock on air, the green flag chosen, the save accepted by the server.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);

    // Act: the server refuses the on-air update.
    fakeServer.refuseLastCommand({
      code: 'INVALID_GRAPHIC_DATA',
      message: 'Os dados não são aceitos pelo gráfico "Relógio de prova".',
    });

    // Assert: the refusal is next to the buttons, the form keeps the green flag, and the
    // panel stays open: the item is saved, but the air is not what the operator asked for.
    expect(
      await screen.findByRole('alert'),
      "the panel must show the server's message for the refused on-air update",
    ).toHaveTextContent('Os dados não são aceitos pelo gráfico "Relógio de prova".');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'what the operator chose must survive the refusal',
    ).toHaveTextContent('Verde');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atualizar no ar' }),
        'the button must come back once the server has answered',
      ).toBeEnabled();
    });
    expect(onClose, 'a refused on-air update must not close the panel').not.toHaveBeenCalled();
  });

  it('sends only the on-air update again at a second press, and closes once it is accepted', async () => {
    // Arrange: the same story: save accepted, on-air update refused, panel still open.
    const { fakeServer, onClose } = await renderEditorWithGreenFlagSavedAndRefusedOnAir();

    // Act: press "Atualizar no ar" again; this time the server accepts the on-air update.
    await pressUpdateOnAirAndWaitForCommand(3, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the green flag is already saved, so the second press had nothing to save
    // and went straight to the on-air update, and the panel closed.
    expect(
      fakeServer.listCommandsReceived(),
      'the second press must send the on-air update again, and no second save',
    ).toEqual([saveOfTheGreenFlag, onAirUpdateOfTheGreenFlag, onAirUpdateOfTheGreenFlag]);
    await waitFor(() => {
      expect(
        onClose,
        'the panel must ask to be closed once the on-air update was accepted',
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('saves a flag put back after the on-air update was refused, so the item does not keep the unwanted one', async () => {
    // Arrange: the green flag is saved in the item, but the air refused it; panel open.
    const { fakeServer, onClose } = await renderEditorWithGreenFlagSavedAndRefusedOnAir();

    // Act: the operator gives up on the green flag, puts "Pré-largada" back and saves.
    chooseOptionInDropdown('Bandeira', 'Pré-largada');
    await pressSaveAndWaitForCommand(3, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the item is saved again with the pre-start flag. Without this third
    // command the server would keep "green" and the next take would air the green flag.
    expect(
      fakeServer.listCommandsReceived(),
      'the flag put back must be saved over the green one the server already stores',
    ).toEqual([saveOfTheGreenFlag, onAirUpdateOfTheGreenFlag, saveOfThePreStartFlagPutBack]);
    await waitFor(() => {
      expect(
        onClose,
        'the panel must ask to be closed once the save was accepted',
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('saves a flag put back with "Atualizar no ar" and leaves the air alone, since it never changed', async () => {
    // Arrange: the green flag is saved in the item, but the air refused it; panel open.
    const { fakeServer, onClose } = await renderEditorWithGreenFlagSavedAndRefusedOnAir();

    // Act: the operator puts "Pré-largada" back and presses "Atualizar no ar".
    chooseOptionInDropdown('Bandeira', 'Pré-largada');
    await pressUpdateOnAirAndWaitForCommand(3, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the item is saved with the pre-start flag and the panel closes. No on-air
    // update follows: the air still shows the pre-start flag it showed all along.
    await waitFor(() => {
      expect(onClose, 'the panel must ask to be closed after the save').toHaveBeenCalledTimes(1);
    });
    expect(
      fakeServer.listCommandsReceived(),
      'only the save may follow: the air already shows the flag that was put back',
    ).toEqual([saveOfTheGreenFlag, onAirUpdateOfTheGreenFlag, saveOfThePreStartFlagPutBack]);
  });

  it('sends no on-air update and asks to be closed when the item left the air during the save', async () => {
    // Arrange: the clock on air, the green flag chosen, and the save waiting for the server.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);

    // Act: another operator clears the stage, and then the server accepts the save.
    fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });
    fakeServer.acceptLastCommand();

    // Assert: there is no instance left to update, so only the save was sent, and the
    // panel closes: everything that could be done was done.
    await waitFor(() => {
      expect(onClose, 'the panel must ask to be closed after the save').toHaveBeenCalledTimes(1);
    });
    expect(
      fakeServer.listCommandsReceived(),
      'an instance that is gone must not be sent an update',
    ).toEqual([saveOfTheGreenFlag]);
  });

  it('does not show a refused on-air update that came from another part of the page', async () => {
    // Arrange: the clock on air; this editor saved a flag with "Salvar item", and the
    // save still waits for the server.
    const { fakeServer, serverStateStore } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Act: meanwhile "Edição rápida" has an on-air update of its own refused, which the
    // page remembers as its last refused command.
    act(() => {
      serverStateStore.getState().rememberCommandError({
        commandType: 'updateInstanceData',
        code: 'INVALID_GRAPHIC_DATA',
        message: 'Os dados não são aceitos pelo gráfico "Relógio de prova".',
      });
    });

    // Assert: the editor sent no on-air update in this opening, so that refusal is not
    // its own and is not shown here.
    expect(
      screen.queryByRole('alert'),
      'an editor that sent no on-air update must not show the refusal of one',
    ).not.toBeInTheDocument();
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });
});
