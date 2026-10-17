/**
 * Item editor panel: moving a saved item to another layer (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-36 the layer of a saved item can be changed in "Editar item" (its
 *   graphic still cannot). The change travels in the same `updateItemFields` as the rest
 *   of the save, as `layerId`, and only when the layer really differs. It decides where
 *   the item goes from its next take on: a graphic already on air from the item stays on
 *   the layer it is on, because the server never moves an instance for a save.
 *
 * What these tests prove:
 *   - A layer chosen by hand is saved as `layerId`, and the panel asks to be closed once
 *     the server accepted it.
 *   - A layer chosen and then put back is not sent, so another operator's layer change
 *     is never undone by an editor that ended where it began.
 *   - "Atualizar no ar" with a new layer saves the layer, then updates the instance on
 *     air in place with the changed values only: no command moves it to the new layer.
 *
 * What these tests deliberately do not cover:
 *   - That the server keeps the on-air instance where it is after a layer change: the
 *     server's item tests prove it.
 *   - Which parts a save carries in every other case: itemCommandsFromEditor.test.ts.
 *   - The read-only graphic of a saved item: ItemEditorPanelEditing.test.tsx.
 */
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  idOfTheInstanceTakenFromTheItem,
  pressSaveAndWaitForCommand,
  pressUpdateOnAirAndWaitForCommand,
  renderItemEditorPanelForItemOnAir,
  renderItemEditorPanelOnFakeServer,
  waitForCommandsReceived,
} from './itemEditorOnFakeServer.testSupport';
import { buildEnduranceStartClockItem } from './itemsLikeTheEditorSaves.testSupport';

const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

describe('changing the layer of a saved item', () => {
  it('saves the new layer as layerId and asks to be closed once the server accepts', async () => {
    // Arrange: the endurance start clock (on the "Relógio" layer) open in the editor.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(
      buildEnduranceStartClockItem(),
    );

    // Act: move it to the "Tarja" layer, save, and let the server accept.
    chooseOptionInDropdown('Camada', 'Tarja');
    await pressSaveAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: one update carrying the new layer and nothing else.
    expect(
      fakeServer.listCommandsReceived(),
      'the save must carry the new layer as layerId, and only that',
    ).toEqual([
      { type: 'updateItemFields', itemId: idOfTheEnduranceStartItem, layerId: 'lower-third' },
    ]);
    await waitFor(() => {
      expect(
        onClose,
        'the panel must ask to be closed once the layer change was accepted',
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('sends no layerId when the layer was put back where it was', async () => {
    // Arrange: the endurance start clock open in the editor.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(buildEnduranceStartClockItem());

    // Act: try the "Tarja" layer, go back to "Relógio", give it a clearer label and save.
    chooseOptionInDropdown('Camada', 'Tarja');
    chooseOptionInDropdown('Camada', 'Relógio');
    typeIntoField('Rótulo', 'Largada — Enduro de Resistência');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the label travels alone; a layer that ended where it began is not a change.
    expect(
      fakeServer.listCommandsReceived(),
      'an unchanged layer must not travel with the save',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Largada — Enduro de Resistência',
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('with "Atualizar no ar", saves the layer and updates the instance on air where it is', async () => {
    // Arrange: the endurance start clock on air on "Relógio", its item open in the editor.
    const { fakeServer } = renderItemEditorPanelForItemOnAir(buildEnduranceStartClockItem());

    // Act: move the item to "Tarja", raise the green flag, press "Atualizar no ar" and let
    // the server accept each command as it arrives.
    chooseOptionInDropdown('Camada', 'Tarja');
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the save carries the layer and the flag; the on-air update changes the
    // flag of that same instance and says nothing about layers, so the clock on air stays
    // on "Relógio" and only the next take uses "Tarja".
    expect(
      fakeServer.listCommandsReceived(),
      'the layer must be saved for the next take, never used to move what is on air',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        layerId: 'lower-third',
        fields: { state: { kind: 'literal', value: 'green' } },
      },
      {
        type: 'updateInstanceData',
        instanceId: idOfTheInstanceTakenFromTheItem,
        data: { state: 'green' },
        takeTimeFieldKeys: [],
      },
    ]);
  });
});
