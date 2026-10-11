/**
 * Item editor panel: changing an existing item (apps/control)
 *
 * What this module is for:
 *   An item prepared the evening before often needs a touch on race day: a clearer
 *   label, another flag, a new time. The item editor panel opens an existing item with
 *   its stored values and "Salvar item" sends one `updateItemFields` command carrying
 *   only what the operator changed.
 *
 * What these tests prove:
 *   - The panel is titled "Editar item" and shows what the item stores, the clock's
 *     time as stored (not moved on by the hours since the save).
 *   - The graphic and the layer of a saved item cannot be changed, and the panel says so.
 *   - Changing one thing sends an `updateItemFields` with that one thing, and the panel
 *     asks to be closed once the server accepted it.
 *   - Saving with nothing changed sends nothing and asks to be closed.
 *   - A stored field the form cannot read is shown with the form's default and named in
 *     a warning.
 *   - Blanking the laps of an item that has laps is refused with a message, because the
 *     update command cannot remove a field.
 *   - When the rundown hands the panel another item, the form shows that other item.
 *
 * What these tests deliberately do not cover:
 *   - Preparing a new item: ItemEditorPanel.test.tsx.
 *   - Field messages, a refused save and the lost connection:
 *     ItemEditorPanelProblems.test.tsx.
 *   - Every combination of changed parts: itemCommandsFromForm.test.ts, without drawing.
 *   - Another operator changing the same item while this panel is open: the form keeps
 *     showing the item as it was when opened, and the save sends only what this
 *     operator changed since then. No test here plays the second operator.
 */
import type { Item } from '@bajaovrlay/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/playout/operatingTheRaceClockForm.testSupport';
import { ControlPageStateProvider } from '@/state/ControlPageStateProvider';
import type { SendCommand } from '@/state/serverConnection';
import { createServerStateStore } from '@/state/serverStateStore';

import {
  buildSlicesWithTheRaceClockAndTheDriverLowerThird,
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServer,
} from './itemEditorOnFakeServer.testSupport';
import { ItemEditorPanel } from './ItemEditorPanel';
import {
  buildDriverLowerThirdItem,
  buildEnduranceStartClockItem,
  idOfTheMainSessionRundown,
} from './itemsLikeTheEditorSaves.testSupport';

/** The endurance start item after the leader's seventh lap was typed into it. */
function buildEnduranceStartClockItemWithSevenLaps(): Item {
  const enduranceStartItem = buildEnduranceStartClockItem();
  return {
    ...enduranceStartItem,
    fields: {
      ...enduranceStartItem.fields,
      lapsCompletedByLeader: { kind: 'literal', value: 7 },
    },
  };
}

describe('the item editor panel for an existing item', () => {
  it('is titled "Editar item" and shows what the item stores', () => {
    // Arrange: the clock item prepared on Friday evening for the endurance start.
    const itemBeingEdited = buildEnduranceStartClockItem();

    // Act: open it in the editor on Saturday morning.
    renderItemEditorPanelOnFakeServer(itemBeingEdited);

    // Assert: every control repeats the item. The time is the stored 240:00: an item is
    // not on air, so nothing has been counting since Friday.
    expect(
      screen.getByRole('heading', { name: 'Editar item' }),
      'the panel must say it is changing an existing item',
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Rótulo'), 'the label must be the stored one').toHaveValue(
      'Largada do Enduro',
    );
    expect(
      screen.getByRole('combobox', { name: 'Cor' }),
      'the colour must be the stored one',
    ).toHaveTextContent('Sucesso');
    expect(screen.getByLabelText('Observações'), 'the notes must be the stored ones').toHaveValue(
      'Entrar quando os carros alinharem.',
    );
    expect(
      screen.getByLabelText('Saída automática (segundos, opcional)'),
      'an item without auto-out must show a blank delay',
    ).toHaveValue('');
    expect(
      screen.getByRole('combobox', { name: 'Modo do relógio' }),
      'the clock mode must be the stored one',
    ).toHaveTextContent('Tempo restante');
    expect(
      screen.getByLabelText('Tempo de referência (mm:ss)'),
      'the time must be the stored one, not moved on since the save',
    ).toHaveValue('240:00');
  });

  it('does not let the graphic or the layer of a saved item be changed, and says why', () => {
    // Arrange: the endurance start item.
    const itemBeingEdited = buildEnduranceStartClockItem();

    // Act: open it in the editor.
    renderItemEditorPanelOnFakeServer(itemBeingEdited);

    // Assert: both dropdowns show the stored choice but are off, with an explanation.
    const graphicDropdown = screen.getByRole('combobox', { name: 'Gráfico' });
    const layerDropdown = screen.getByRole('combobox', { name: 'Camada' });
    expect(graphicDropdown, 'the graphic must be shown').toHaveTextContent('Relógio de prova');
    expect(graphicDropdown, 'the graphic of a saved item cannot be changed').toBeDisabled();
    expect(layerDropdown, 'the layer must be shown').toHaveTextContent('Relógio');
    expect(layerDropdown, 'the layer of a saved item cannot be changed').toBeDisabled();
    expect(
      screen.getByText(
        'O gráfico e a camada de um item salvo não mudam. Para trocá-los, exclua o item e crie outro.',
      ),
      'the panel must say how to get another graphic or layer',
    ).toBeInTheDocument();
  });

  it('sends updateItemFields with only what changed and asks to be closed once the server accepts', async () => {
    // Arrange: the endurance start item open in the editor.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(
      buildEnduranceStartClockItem(),
    );

    // Act: give it a clearer label and the green flag, save, and let the server accept.
    typeIntoField('Rótulo', 'Largada — Enduro de Resistência');
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressSaveAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: one update naming the item, the new label and the one changed field. The
    // clock's time and reference moment do not travel, so the prepared clock is untouched.
    expect(
      fakeServer.listCommandsReceived(),
      'the save must send one updateItemFields carrying only the two changes',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90',
        label: 'Largada — Enduro de Resistência',
        fields: { state: { kind: 'literal', value: 'green' } },
      },
    ]);
    await waitFor(() => {
      expect(
        onClose,
        'the panel must ask to be closed once the save was accepted',
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('sends nothing and asks to be closed when nothing was changed', async () => {
    // Arrange: the endurance start item open in the editor, untouched.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(
      buildEnduranceStartClockItem(),
    );

    // Act: press "Salvar item" straight away.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));

    // Assert: there was nothing to save, so the panel closes without a command.
    await waitFor(() => {
      expect(onClose, 'a save with no change must still close the panel').toHaveBeenCalledTimes(1);
    });
    expect(
      fakeServer.listCommandsReceived(),
      'a save with no change must not send any command',
    ).toEqual([]);
  });

  it('shows the default and a warning for a stored field it cannot read', () => {
    // Arrange: the endurance start item whose flag was stored by a script as "blue",
    // which is not one of the race clock's six flags.
    const enduranceStartItem = buildEnduranceStartClockItem();
    const itemWithAFlagTheFormCannotRead: Item = {
      ...enduranceStartItem,
      fields: { ...enduranceStartItem.fields, state: { kind: 'literal', value: 'blue' } },
    };

    // Act: open it in the editor.
    renderItemEditorPanelOnFakeServer(itemWithAFlagTheFormCannotRead);

    // Assert: the flag shows the form's default, and a warning names the field and
    // says what saving will do.
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'a flag that cannot be read must show the default "Pré-largada"',
    ).toHaveTextContent('Pré-largada');
    expect(
      screen.getByRole('status'),
      'the warning must name the field that could not be read',
    ).toHaveTextContent(
      'Estes campos do item não puderam ser lidos e aparecem com o valor padrão; salvar grava o que está no formulário: Bandeira.',
    );
  });

  it('refuses to blank the laps of an item that has laps, and sends nothing', async () => {
    // Arrange: the endurance start item with 7 laps, open in the editor.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(
      buildEnduranceStartClockItemWithSevenLaps(),
    );

    // Act: erase the laps and press "Salvar item".
    typeIntoField('Voltas do líder (opcional)', '');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));

    // Assert: the laps field explains why, nothing was sent and the panel stays open.
    expect(
      await screen.findByText(
        'As voltas de um item salvo não podem ser apagadas. Informe um número ou exclua o item e crie outro.',
      ),
      'the laps field must explain that a stored field cannot be removed',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'a save that would need to remove a field must not send any command',
    ).toEqual([]);
    expect(
      onClose,
      'the panel must stay open so the operator can correct it',
    ).not.toHaveBeenCalled();
  });

  it('shows the other item when the rundown hands it another item to edit', () => {
    // Arrange: a page already holding the server's state, with the endurance start item
    // open in the editor. (Drawn by hand here because the test must draw twice.)
    const serverStateStore = createServerStateStore();
    serverStateStore
      .getState()
      .replaceEverySlice(buildSlicesWithTheRaceClockAndTheDriverLowerThird());
    serverStateStore.getState().changeConnectionStatus('connected');
    // This test saves nothing, so the page's way to send commands is never called.
    const sendCommandNeverUsedHere: SendCommand = () =>
      Promise.resolve({ ok: true, requestId: 'pedido-nunca-enviado' });
    function buildPageShowingItem(itemBeingEdited: Item) {
      return (
        <ControlPageStateProvider
          serverStateStore={serverStateStore}
          sendCommand={sendCommandNeverUsedHere}
        >
          <ItemEditorPanel
            rundownId={idOfTheMainSessionRundown}
            itemBeingEdited={itemBeingEdited}
            onClose={() => undefined}
          />
        </ControlPageStateProvider>
      );
    }
    const page = render(buildPageShowingItem(buildEnduranceStartClockItem()));

    // Act: the operator clicks another row of the rundown: the lower third of team 42.
    page.rerender(buildPageShowingItem(buildDriverLowerThirdItem()));

    // Assert: the form is that item's, not a leftover of the first one.
    expect(screen.getByLabelText('Rótulo'), "the label must be the second item's").toHaveValue(
      'Tarja da equipe 42',
    );
    expect(
      screen.getByLabelText('Saída automática (segundos, opcional)'),
      "the delay must be the second item's 8 seconds",
    ).toHaveValue('8');
    expect(
      screen.queryByLabelText('Nome da sessão'),
      'the race clock fields of the first item must be gone',
    ).toBeNull();
  });
});
