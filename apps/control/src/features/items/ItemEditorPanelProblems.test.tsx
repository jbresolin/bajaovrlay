/**
 * Item editor panel: when something is wrong (apps/control)
 *
 * What this module is for:
 *   The item editor must say plainly, in pt-BR, why an item was not saved: a field is
 *   empty or badly typed, the server refused the command, or there is no connection.
 *   What the operator typed must survive all three, so nothing has to be typed twice.
 *
 * What these tests prove:
 *   - A missing label shows its pt-BR message under the field, sends nothing and keeps
 *     the panel open.
 *   - Problems in the item's own fields and in the race clock fields are all shown at
 *     the same press.
 *   - When the server refuses the save, its pt-BR message is shown in the panel, the
 *     form keeps what was typed and the panel stays open.
 *   - A refusal the page still remembers from an earlier opening of the editor is not
 *     shown by an editor that has not tried to save yet.
 *   - Cancelling while a save still waits for the server asks to be closed only once,
 *     even when the server's "accepted" arrives afterwards.
 *   - While the page is not connected "Salvar item" is disabled and says why, and
 *     "Cancelar" still works.
 *
 * What these tests deliberately do not cover:
 *   - What a correct save sends: ItemEditorPanel.test.tsx and
 *     ItemEditorPanelEditing.test.tsx.
 *   - Every rule: itemEditorForm.test.ts and features/playout/raceClockTakeForm.test.ts
 *     list them one by one.
 *   - A save the server never answers (the 5-second timeout), which state/ tests cover
 *     for every command alike.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { typeIntoField } from '@/features/playout/operatingTheRaceClockForm.testSupport';
import { focusAreaAroundDisabledButton } from '@/state/controlPageOnFakeServer.testSupport';

import {
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServer,
} from './itemEditorOnFakeServer.testSupport';

describe('the item editor panel when something is wrong', () => {
  it('shows the pt-BR message under an empty label, sends nothing and stays open', async () => {
    // Arrange: the editor for a new item, with the label left empty.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(null);

    // Act: press "Salvar item".
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));

    // Assert: the field explains what is missing, is marked invalid, and nothing was sent.
    expect(
      await screen.findByText('Informe o rótulo do item.'),
      'the message for the missing label must be on screen',
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Rótulo'),
      'the field must be marked invalid for screen readers',
    ).toBeInvalid();
    expect(
      screen.getByLabelText('Rótulo'),
      'the field must point at its message for screen readers',
    ).toHaveAccessibleDescription('Informe o rótulo do item.');
    expect(
      fakeServer.listCommandsReceived(),
      'a form with a missing label must not send any command',
    ).toEqual([]);
    expect(onClose, 'the panel must stay open so the label can be typed').not.toHaveBeenCalled();
  });

  it('shows the problems of the item fields and of the race clock fields at the same press', async () => {
    // Arrange: a new item with no label, an auto-out of zero and one hour typed as h:mm:ss.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Saída automática (segundos, opcional)', '0');
    typeIntoField('Tempo de referência (mm:ss)', '1:00:00');

    // Act: press "Salvar item".
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));

    // Assert: all three messages are there, so the operator fixes them in one pass.
    expect(
      await screen.findByText('Informe o rótulo do item.'),
      'the missing label must be reported',
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Informe os segundos como um número inteiro maior que zero ou deixe em branco.',
      ),
      'the auto-out of zero must be reported',
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Use minutos e segundos no formato mm:ss, por exemplo 12:30.'),
      'the badly typed time of the race clock must be reported at the same press',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'a form with wrong fields must not send any command',
    ).toEqual([]);
  });

  it("shows the server's pt-BR message when the save is refused, keeps the form and stays open", async () => {
    // Arrange: a new item for the endurance start, saved and on its way to the server.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Largada do Enduro');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Act: the server answers that the rundown is gone (its database was replaced).
    fakeServer.refuseLastCommand({
      code: 'RUNDOWN_NOT_FOUND',
      message: 'O rundown "sessao-principal" não existe.',
    });

    // Assert: the refusal is shown in the server's own words, the label is still
    // there, the button can be pressed again and the panel did not ask to be closed.
    expect(
      await screen.findByRole('alert'),
      "the panel must show the server's pt-BR message",
    ).toHaveTextContent('O rundown "sessao-principal" não existe.');
    expect(
      screen.getByLabelText('Rótulo'),
      'what the operator typed must survive a refused save',
    ).toHaveValue('Largada do Enduro');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Salvar item' }),
        'the save button must come back once the server has answered',
      ).toBeEnabled();
    });
    expect(onClose, 'a refused save must not close the panel').not.toHaveBeenCalled();
  });

  it('does not show a refusal left over from an earlier opening of the editor', () => {
    // Arrange: the editor for a new item, on a page that still remembers a save the
    // server refused the last time the editor was open (the page keeps the last refusal
    // until some command succeeds).
    const { serverStateStore } = renderItemEditorPanelOnFakeServer(null);

    // Act: the old refusal is in the page's memory; nothing was pressed in this opening.
    act(() => {
      serverStateStore.getState().rememberCommandError({
        commandType: 'createItem',
        code: 'GRAPHIC_NOT_FOUND',
        message: 'O gráfico "tarja-de-piloto" não está registrado.',
      });
    });

    // Assert: the freshly opened editor shows no error; it has not tried to save yet.
    expect(
      screen.queryByRole('alert'),
      'an editor that has not tried to save must not show an old refusal',
    ).not.toBeInTheDocument();
  });

  it('asks to be closed only once when the operator cancels while a save is still waiting', async () => {
    // Arrange: a new item saved, with the server slow to answer.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Largada do Enduro');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Act: the operator gives up waiting and cancels; then the server's "accepted" arrives.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fakeServer.acceptLastCommand();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Salvar item' }),
        'the late answer must have been dealt with',
      ).toBeEnabled();
    });

    // Assert: one request to close, not two. A second one could close an editor the
    // operator opened for another item in the meantime.
    expect(onClose, 'the late answer must not ask to be closed again').toHaveBeenCalledTimes(1);
  });

  it('disables "Salvar item" and says why while the connection is down, and still lets the operator cancel', async () => {
    // Arrange: the editor for a new item on a connected page.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(null);

    // Act: the line drops, the operator reaches for "Salvar item" and then cancels.
    fakeServer.dropConnection();
    const saveButton = screen.getByRole('button', { name: 'Salvar item' });
    focusAreaAroundDisabledButton(saveButton);
    const tooltip = await screen.findByRole('tooltip');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert: saving is off with the reason in pt-BR, and cancelling needed no server.
    expect(saveButton, '"Salvar item" cannot work without a connection').toBeDisabled();
    expect(tooltip, 'the tooltip must tell the operator why saving is off').toHaveTextContent(
      'Sem conexão com o servidor. Os comandos voltam quando ela voltar.',
    );
    expect(onClose, '"Cancelar" must work without a connection').toHaveBeenCalledTimes(1);
  });
});
