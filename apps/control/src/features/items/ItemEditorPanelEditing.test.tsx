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
 *     time as stored (not moved on by the hours since the save) and each field in the
 *     kind it is stored in.
 *   - The graphic and the layer of a saved item cannot be changed, and the panel says so.
 *   - Changing one thing sends an `updateItemFields` with that one thing, and the panel
 *     asks to be closed once the server accepted it.
 *   - Saving with nothing changed sends nothing and asks to be closed.
 *   - A stored field the form cannot show is drawn with the manifest's default and named
 *     in a warning.
 *   - Clearing an optional field of an item that has it (the leader's laps) is saved: the
 *     field is sent as "no value".
 *   - An item whose reference moment is a stored number shows that number, and an edit of
 *     something else leaves it alone.
 *   - An item with no reference moment at all is named in the warning and gets "the
 *     moment of the take" at the next save, whatever else was changed.
 *   - When the rundown hands the panel another item, the form shows that other item.
 *
 * What these tests deliberately do not cover:
 *   - Preparing a new item: ItemEditorPanel.test.tsx.
 *   - An item that is on air and "Atualizar no ar": ItemEditorPanelUpdateOnAir.test.tsx.
 *   - Field messages, a refused save and the lost connection:
 *     ItemEditorPanelProblems.test.tsx.
 *   - Every way a field can differ from what is stored:
 *     features/schemaForm/itemFieldsFromSchemaForm.test.ts, without drawing.
 *   - Another operator changing the same item while this panel is open: the form keeps
 *     showing the item as it was when opened, and the save sends only what this
 *     operator changed since then. No test here plays the second operator.
 */
import type { Item } from '@bajaovrlay/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  pressButton,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { ControlPageStateProvider } from '@/state/ControlPageStateProvider';
import type { SendCommand } from '@/state/serverConnection';
import { createServerStateStore } from '@/state/serverStateStore';

import {
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServer,
} from './itemEditorOnFakeServer.testSupport';
import { ItemEditorPanel } from './ItemEditorPanel';
import {
  buildEnduranceStartClockItem,
  buildEnduranceStartClockItemSavedWithTheMomentOfTheSave,
  buildEnduranceStartClockItemWithSevenLaps,
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
  idOfTheMainSessionRundown,
  momentTheItemWasSavedInMilliseconds,
  raceClockLapsLabel,
  raceClockReferenceMomentLabel,
  raceClockReferenceTimeLabel,
} from './itemsLikeTheEditorSaves.testSupport';

const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

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
      screen.getByLabelText(raceClockReferenceTimeLabel),
      'the time must be the stored one, not moved on since the save',
    ).toHaveValue('240:00');
    expect(
      screen.getByRole('combobox', { name: `Como preencher ${raceClockReferenceMomentLabel}` }),
      'a reference moment stored as "the moment of the take" must be shown as that',
    ).toHaveTextContent('Momento da entrada no ar');
    expect(
      screen.queryByRole('status'),
      'an item the form can show in full must open without any warning',
    ).toBeNull();
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
        itemId: idOfTheEnduranceStartItem,
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

  it('shows the default and a warning for a stored field it cannot show', () => {
    // Arrange: the endurance start item whose flag was stored by a script as "blue",
    // which is not one of the race clock's six flags.
    const enduranceStartItem = buildEnduranceStartClockItem();
    const itemWithAFlagTheFormCannotShow: Item = {
      ...enduranceStartItem,
      fields: { ...enduranceStartItem.fields, state: { kind: 'literal', value: 'blue' } },
    };

    // Act: open it in the editor.
    renderItemEditorPanelOnFakeServer(itemWithAFlagTheFormCannotShow);

    // Assert: the flag shows the manifest's default, and a warning names the field and
    // says what saving will do.
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'a flag that cannot be shown must appear as the default "Pré-largada"',
    ).toHaveTextContent('Pré-largada');
    expect(
      screen.getByRole('status'),
      'the warning must name the field that could not be read',
    ).toHaveTextContent(
      'Estes campos do item não puderam ser lidos e aparecem com o valor padrão; salvar grava o que está no formulário: Bandeira.',
    );
  });

  it('saves the laps of an item as "no value" when the operator clears them', async () => {
    // Arrange: the endurance start item with 7 laps, open in the editor.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(
      buildEnduranceStartClockItemWithSevenLaps(),
    );
    const lapsShownAtTheOpening = (screen.getByLabelText(raceClockLapsLabel) as HTMLInputElement)
      .value;

    // Act: clear the laps with their "limpar" button and save.
    pressButton(`Limpar ${raceClockLapsLabel}`);
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the update stores "no value" for the laps. The update command cannot remove
    // a field, so it writes null, and the server leaves a null field out at the take.
    expect(lapsShownAtTheOpening, 'the stored laps must be shown when the item opens').toBe('7');
    expect(
      fakeServer.listCommandsReceived(),
      'cleared laps must be saved as a literal null, with nothing else in the update',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { lapsCompletedByLeader: { kind: 'literal', value: null } },
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('shows a reference moment stored as a number and leaves it alone when something else is edited', async () => {
    // Arrange: the item as an earlier editor (or a script) stored it: its reference
    // moment is the number of the Friday save, not "the moment of the take".
    const { fakeServer } = renderItemEditorPanelOnFakeServer(
      buildEnduranceStartClockItemSavedWithTheMomentOfTheSave(),
    );
    const kindShownAtTheOpening = screen.getByRole('combobox', {
      name: `Como preencher ${raceClockReferenceMomentLabel}`,
    }).textContent;
    const referenceMomentShownAtTheOpening = (
      screen.getByLabelText(raceClockReferenceMomentLabel) as HTMLInputElement
    ).value;

    // Act: change the label and the clock's time, and save.
    typeIntoField('Rótulo', 'Largada — Enduro de Resistência');
    typeIntoField(raceClockReferenceTimeLabel, '90:00');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the stored number was shown as a typed value, and the update carries the
    // label and the time (90:00 is 5 400 000 ms) only. The editor has no rule of its own
    // about clocks any more: a reference moment changes only when the operator changes it.
    expect(kindShownAtTheOpening, 'a stored number must be shown as a typed value').toContain(
      'Valor digitado',
    );
    expect(referenceMomentShownAtTheOpening, 'the stored number must be the one on screen').toBe(
      String(momentTheItemWasSavedInMilliseconds),
    );
    expect(
      fakeServer.listCommandsReceived(),
      'the reference moment must not travel with an edit of something else',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Largada — Enduro de Resistência',
        fields: { referenceTimeMs: { kind: 'literal', value: 5_400_000 } },
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('names a missing reference moment in the warning and stores "the moment of the take" at the next save', async () => {
    // Arrange: the item as a hand-made API call stored it, with no reference moment at
    // all, although the race clock requires one.
    const enduranceStartItem = buildEnduranceStartClockItem();
    const fieldsWithoutAReferenceMoment = Object.fromEntries(
      Object.entries(enduranceStartItem.fields).filter(
        ([fieldKey]) => fieldKey !== 'referenceWallClockMs',
      ),
    );
    const { fakeServer } = renderItemEditorPanelOnFakeServer({
      ...enduranceStartItem,
      fields: fieldsWithoutAReferenceMoment,
    });
    const warningShownAtTheOpening = screen.getByRole('status').textContent;

    // Act: change only the label and save.
    typeIntoField('Rótulo', 'Largada — Enduro de Resistência');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the warning named the field, and the save wrote what the form shows for it,
    // "the moment of the take", as the warning says a save does.
    expect(warningShownAtTheOpening, 'the warning must name the missing field').toContain(
      raceClockReferenceMomentLabel,
    );
    expect(
      fakeServer.listCommandsReceived(),
      'the save must give the item the reference moment it lacks, left to the take',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Largada — Enduro de Resistência',
        fields: { referenceWallClockMs: { kind: 'takeTime' } },
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('shows the other item when the rundown hands it another item to edit', () => {
    // Arrange: a page already holding the server's state, with the endurance start item
    // open in the editor. (Drawn by hand here because the test must draw twice.)
    const serverStateStore = createServerStateStore();
    serverStateStore.getState().replaceEverySlice(buildSlicesWithTheRaceClockAndTheLowerThird());
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
    page.rerender(buildPageShowingItem(buildInterviewLowerThirdItem()));

    // Assert: the form is that item's, not a leftover of the first one, down to the
    // fields of its graphic.
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
    expect(
      screen.getByLabelText('Nome'),
      "the fields of the second item's graphic must show what that item stores",
    ).toHaveValue('Ana Souza');
  });
});
