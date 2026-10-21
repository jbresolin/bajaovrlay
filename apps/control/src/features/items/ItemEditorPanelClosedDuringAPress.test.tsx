/**
 * Item editor panel: closed while a press is still under way (apps/control)
 *
 * What this module is for:
 *   A press of a save button takes a moment: the forms are checked, and each command
 *   waits for the server's answer. "Cancelar" stays available all that time, and the
 *   rundown can hand the editor another item. Once the operator has cancelled, or the
 *   editor has left the page, the editor must send nothing more: a command already on
 *   its way cannot be called back, but no new one may follow it. Above all, the program
 *   output must not change after the operator pressed "Cancelar".
 *
 * What these tests prove:
 *   - "Cancelar" pressed while the save of "Atualizar no ar" waits for the server: when
 *     the save is accepted afterwards, the on-air update is not sent.
 *   - Another item opened in the editor while that save waits: the same, no on-air
 *     update is sent for the item that was left.
 *   - "Cancelar" pressed straight after "Salvar item", while the forms are still being
 *     checked: the new item is not sent at all.
 *
 * What these tests deliberately do not cover:
 *   - That a late answer does not ask to be closed a second time:
 *     ItemEditorPanelProblems.test.tsx.
 *   - Taking back a save the server already received: the editor has no undo, and the
 *     save that was waiting when the operator cancelled stays saved.
 *   - A press that nobody interrupts: ItemEditorPanelUpdateOnAir.test.tsx.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  openAnotherItemButtonText,
  pressUpdateOnAirAndWaitForCommand,
  renderItemEditorPanelForItemOnAir,
  renderItemEditorPanelForItemOnAirWithAnotherItemToOpen,
  renderItemEditorPanelForNewRaceClockItem,
  waitForThePageToDealWithTheLastAnswer,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildEnduranceStartClockItem,
  buildInterviewLowerThirdItem,
} from './itemsLikeTheEditorSaves.testSupport';

const saveOfTheGreenFlag = {
  type: 'updateItemFields',
  itemId: '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90',
  fields: { state: { kind: 'literal', value: 'green' } },
};

describe('the item editor closed while a press is still under way', () => {
  it('sends no on-air update when the operator cancels while the save of "Atualizar no ar" is waiting', async () => {
    // Arrange: the endurance start clock on air, the green flag chosen, "Atualizar no
    // ar" pressed, and its save still waiting for the server.
    const { fakeServer } = renderItemEditorPanelForItemOnAir(buildEnduranceStartClockItem());
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);

    // Act: the operator presses "Cancelar"; only then does the server accept the save.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fakeServer.acceptLastCommand();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atualizar no ar' }),
        'the late answer must have been dealt with',
      ).toBeEnabled();
    });

    // Assert: the save was already on its way and stays, but nothing followed it. An
    // on-air update here would change the program output after the operator cancelled.
    expect(
      fakeServer.listCommandsReceived(),
      'after "Cancelar" the editor must not send the on-air update',
    ).toEqual([saveOfTheGreenFlag]);
  });

  it('sends no on-air update when another item is opened while the save of "Atualizar no ar" is waiting', async () => {
    // Arrange: the same press and the same waiting save, in an editor whose rundown can
    // open the interview lower third instead.
    const fakeServer = renderItemEditorPanelForItemOnAirWithAnotherItemToOpen(
      buildEnduranceStartClockItem(),
      buildInterviewLowerThirdItem(),
    );
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);

    // Act: the operator opens the other item, so the clock's editor leaves the page;
    // only then does the server accept the save.
    fireEvent.click(screen.getByRole('button', { name: openAnotherItemButtonText }));
    fakeServer.acceptLastCommand();
    await waitForThePageToDealWithTheLastAnswer();

    // Assert: the editor now shows the other item, and the one that left sent nothing
    // after its save. If it had, a refusal of that update would be shown nowhere.
    expect(
      screen.getByLabelText('Rótulo'),
      'the editor must now be the one of the interview lower third',
    ).toHaveValue('Tarja da equipe 42');
    expect(
      fakeServer.listCommandsReceived(),
      'an editor that left the page must not send the on-air update',
    ).toEqual([saveOfTheGreenFlag]);
  });

  it('sends nothing when the operator cancels while the forms are still being checked', async () => {
    // Arrange: the editor for a new race clock item with its label typed, so the check
    // of the forms would pass and the item would be sent if nothing interrupted it.
    const { fakeServer, onClose } = renderItemEditorPanelForNewRaceClockItem();
    typeIntoField('Rótulo', 'Largada do Enduro');

    // Act: "Salvar item" and, before the check of the fields has finished, "Cancelar".
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Salvar item' }),
        'the press must have run to its end',
      ).toBeEnabled();
    });

    // Assert: the item was not created, and the editor asked to be closed once.
    expect(
      fakeServer.listCommandsReceived(),
      'a press cancelled before anything was sent must send nothing',
    ).toEqual([]);
    expect(onClose, '"Cancelar" must ask to be closed once').toHaveBeenCalledTimes(1);
  });
});
