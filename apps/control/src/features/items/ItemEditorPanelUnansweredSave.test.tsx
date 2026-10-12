/**
 * Item editor panel: a save the server never answered (apps/control)
 *
 * What this module is for:
 *   A command the server does not answer within 5 seconds counts as failed, but it may
 *   still have been applied: only the answer is missing. After such a save the editor
 *   stays open and cannot know whether the item now stores the new value or the old one.
 *   If the operator then puts the value back, the editor must save it again, or the
 *   server could keep the value the operator gave up on and the next take would air it.
 *
 * What these tests prove:
 *   - A flag put back after an unanswered save is sent as a save of its own, and the
 *     panel closes once that save is accepted.
 *   - Pressing "Salvar item" again without touching the form sends the same save again.
 *   - After a save the server REFUSED, a flag put back sends nothing: a refusal is an
 *     answer, so the editor knows the item still stores the old flag.
 *
 * What these tests deliberately do not cover:
 *   - The 5-second timeout itself and its message: state/serverConnection.test.ts.
 *   - The bookkeeping as pure functions: itemsTheServerMayStore.test.ts.
 *   - "Atualizar no ar": its on-air update is compared with the item as opened and plays
 *     no part here (ItemEditorPanelUpdateOnAirProblems.test.tsx).
 */
import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  chooseOptionInDropdown,
  pressButton,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { commandTimeoutInMilliseconds } from '@/state/serverConnection';

import {
  type ItemEditorOnFakeServer,
  renderItemEditorPanelOnFakeServer,
} from './itemEditorOnFakeServer.testSupport';
import { buildEnduranceStartClockItem } from './itemsLikeTheEditorSaves.testSupport';

const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

const saveOfTheGreenFlag = {
  type: 'updateItemFields',
  itemId: idOfTheEnduranceStartItem,
  fields: { state: { kind: 'literal', value: 'green' } },
};
const saveOfThePreStartFlagPutBack = {
  type: 'updateItemFields',
  itemId: idOfTheEnduranceStartItem,
  fields: { state: { kind: 'literal', value: 'pre' } },
};

/**
 * Moves the page's clock forward and lets the page finish what that set off (a press
 * checks its forms and waits for the server in several small steps). Time stands still
 * in these tests, so "5 seconds without an answer" takes no real time.
 */
async function letTimePassAndThePageSettle(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

/** Presses a button and lets the page check its forms and send what the press sends. */
async function pressButtonAndLetThePageSend(buttonName: string): Promise<void> {
  pressButton(buttonName);
  await letTimePassAndThePageSettle(0);
}

/**
 * Draws the editor for the stored endurance start clock (pre-start flag) with time
 * standing still, chooses the green flag and presses "Salvar item". It returns with the
 * save sent and still waiting for the server.
 */
async function renderEditorWithTheSaveOfTheGreenFlagWaiting(): Promise<ItemEditorOnFakeServer> {
  vi.useFakeTimers();
  const editorOnFakeServer = renderItemEditorPanelOnFakeServer(buildEnduranceStartClockItem());
  chooseOptionInDropdown('Bandeira', 'Verde');
  await pressButtonAndLetThePageSend('Salvar item');
  return editorOnFakeServer;
}

describe('the item editor after a save the server never answered', () => {
  it('saves a flag put back after the unanswered save, so the item cannot keep the unwanted one', async () => {
    // Arrange: the save of the green flag is sent and the server stays silent for 5 seconds.
    const { fakeServer, onClose } = await renderEditorWithTheSaveOfTheGreenFlagWaiting();
    await letTimePassAndThePageSettle(commandTimeoutInMilliseconds);

    // Act: the operator gives up on the green flag, puts "Pré-largada" back and saves;
    // this time the server answers.
    chooseOptionInDropdown('Bandeira', 'Pré-largada');
    await pressButtonAndLetThePageSend('Salvar item');
    fakeServer.acceptLastCommand();
    await letTimePassAndThePageSettle(0);

    // Assert: the pre-start flag was sent, although it is the flag the item had when the
    // editor opened: the server may have stored the green one. Then the panel closed.
    expect(
      fakeServer.listCommandsReceived(),
      'the flag put back must be saved, because the unanswered save may have been applied',
    ).toEqual([saveOfTheGreenFlag, saveOfThePreStartFlagPutBack]);
    expect(
      onClose,
      'the panel must ask to be closed once the save was accepted',
    ).toHaveBeenCalledTimes(1);
  });

  it('sends the same save again when "Salvar item" is pressed again on the untouched form', async () => {
    // Arrange: the save of the green flag is sent and the server stays silent for 5 seconds.
    const { fakeServer, onClose } = await renderEditorWithTheSaveOfTheGreenFlagWaiting();
    await letTimePassAndThePageSettle(commandTimeoutInMilliseconds);

    // Act: the operator reads "the server did not answer" and presses "Salvar item" again.
    await pressButtonAndLetThePageSend('Salvar item');

    // Assert: the green flag is sent a second time, and the panel waits for the answer.
    expect(
      fakeServer.listCommandsReceived(),
      'the retry must send the green flag again, since the first save may have been lost',
    ).toEqual([saveOfTheGreenFlag, saveOfTheGreenFlag]);
    expect(
      screen.getByRole('alert'),
      'the message of the unanswered save must stay until a command succeeds',
    ).toBeInTheDocument();
    expect(onClose, 'the panel must stay open while the retry waits').not.toHaveBeenCalled();
    // (Then the server answers, so no command is left waiting for its timeout.)
    fakeServer.acceptLastCommand();
  });

  it('sends nothing for a flag put back after a save the server refused', async () => {
    // Arrange: the save of the green flag is sent and the server refuses it.
    const { fakeServer, onClose } = await renderEditorWithTheSaveOfTheGreenFlagWaiting();
    fakeServer.refuseLastCommand({
      code: 'ITEM_NOT_FOUND',
      message: 'O item "0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90" não existe.',
    });
    await letTimePassAndThePageSettle(0);

    // Act: the operator puts "Pré-largada" back and presses "Salvar item".
    chooseOptionInDropdown('Bandeira', 'Pré-largada');
    await pressButtonAndLetThePageSend('Salvar item');

    // Assert: a refusal is an answer, so the item still stores the pre-start flag, the
    // form shows nothing new, and the panel closes without a second command.
    expect(
      fakeServer.listCommandsReceived(),
      'after a refused save the flag put back equals what is stored and must not be sent',
    ).toEqual([saveOfTheGreenFlag]);
    expect(onClose, 'with nothing to save the panel must ask to be closed').toHaveBeenCalledTimes(
      1,
    );
  });
});
