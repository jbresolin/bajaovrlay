/**
 * Item editor panel: "Atualizar no ar" for an item that is on air (apps/control)
 *
 * What this module is for:
 *   An item fired from the rundown is on air as an instance that remembers the item.
 *   When the operator edits that item (the flag turned green, the leader finished another
 *   lap), "Salvar item" changes only the stored item: the audience would see the change
 *   at the next take. "Atualizar no ar" does both at one press: it saves the item
 *   (`updateItemFields`) and then puts the changed values on the instance on air
 *   (`updateInstanceData`), without a new take.
 *
 * What these tests prove:
 *   - The button is offered only while the stored item being edited has an instance on
 *     the program output: not for a new item, not for an item that is not on air, and
 *     not for one that is only on the preview output.
 *   - A press sends the save first and, once the server accepted it, the on-air update
 *     with only the values that changed; the panel asks to be closed after both.
 *   - A cleared field is saved as "no value" and sent on air as null, which takes it off.
 *   - A change of label alone sends the save and nothing on air.
 *   - A field switched to "filled at the take" is saved but never sent on air.
 *   - With nothing changed, the press sends nothing and the panel asks to be closed.
 *   - "Salvar item" on an item that is on air still sends only the save.
 *
 * What these tests deliberately do not cover:
 *   - A refused save or on-air update, a wrong field, and an item that leaves the air
 *     during the press: ItemEditorPanelUpdateOnAirProblems.test.tsx.
 *   - Choosing the instance when the item is on air more than once:
 *     itemInstanceOnAir.test.ts.
 *   - What the renderer does with the update (same DOM node): the e2e tests.
 */
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  pressButton,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  idOfTheInstanceTakenFromTheItem,
  momentTheItemWasTaken,
  pressSaveAndWaitForCommand,
  pressUpdateOnAirAndWaitForCommand,
  renderItemEditorPanelForItemOnAir,
  renderItemEditorPanelOnFakeServer,
  renderItemEditorPanelOnFakeServerWithSlices,
  waitForCommandsReceived,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildEnduranceStartClockItem,
  buildEnduranceStartClockItemSavedWithTheMomentOfTheSave,
  buildEnduranceStartClockItemWithSevenLaps,
  buildInstanceTakenFromItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
  raceClockLapsLabel,
  raceClockReferenceMomentLabel,
} from './itemsLikeTheEditorSaves.testSupport';

const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

describe('when the item editor offers "Atualizar no ar"', () => {
  it('offers it for a stored item that is on the program output', () => {
    // Arrange: the endurance start clock, fired from the rundown and on air.

    // Act: open its item in the editor.
    renderItemEditorPanelForItemOnAir(buildEnduranceStartClockItem());

    // Assert: the third button is there, between saving and cancelling.
    expect(
      screen.getByRole('button', { name: 'Atualizar no ar' }),
      'an item that is on air must offer the on-air update',
    ).toBeInTheDocument();
  });

  it('does not offer it for a new item', () => {
    // Arrange: a connected page with nothing on air.

    // Act: open the editor for a new item.
    renderItemEditorPanelOnFakeServer(null);

    // Assert: a new item cannot be on air.
    expect(
      screen.queryByRole('button', { name: 'Atualizar no ar' }),
      'a new item has nothing on air to update',
    ).toBeNull();
  });

  it('does not offer it for a stored item that is not on air', () => {
    // Arrange: the endurance start item, prepared but not taken yet.

    // Act: open it in the editor.
    renderItemEditorPanelOnFakeServer(buildEnduranceStartClockItem());

    // Assert: only "Salvar item" and "Cancelar".
    expect(
      screen.queryByRole('button', { name: 'Atualizar no ar' }),
      'an item that was not taken has nothing on air to update',
    ).toBeNull();
  });

  it('does not offer it for an item that is only on the preview output', () => {
    // Arrange: the endurance start item taken to the preview output, which nobody sees.
    const itemOnPreview = buildEnduranceStartClockItem();

    // Act: open it in the editor.
    renderItemEditorPanelOnFakeServerWithSlices(itemOnPreview, {
      ...buildSlicesWithTheRaceClockAndTheLowerThird(),
      items: [itemOnPreview],
      instances: [
        buildInstanceTakenFromItem({
          id: idOfTheInstanceTakenFromTheItem,
          item: itemOnPreview,
          layerId: 'clock',
          target: 'preview',
          takenAt: momentTheItemWasTaken,
        }),
      ],
    });

    // Assert: the preview output is not "on air".
    expect(
      screen.queryByRole('button', { name: 'Atualizar no ar' }),
      'an instance on the preview output must not bring the on-air update',
    ).toBeNull();
  });
});

describe('a press of "Atualizar no ar"', () => {
  it('saves the item first and then sends the changed values to the instance on air', async () => {
    // Arrange: the endurance start clock on air, its item open in the editor.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );

    // Act: the race starts: raise the green flag and name the item accordingly, press
    // "Atualizar no ar", and let the server accept each command as it arrives.
    typeIntoField('Rótulo', 'Enduro em andamento');
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    const timesClosedAfterTheSaveWasSent = onClose.mock.calls.length;
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);
    const timesClosedBeforeTheOnAirUpdateWasAnswered = onClose.mock.calls.length;
    fakeServer.acceptLastCommand();

    // Assert: the save carries the label and the flag; the on-air update names the
    // instance and carries the flag alone (a label is not on air), as a plain value.
    // Nothing else of the clock travels, so the clock on air keeps counting as it was.
    expect(
      fakeServer.listCommandsReceived(),
      'the press must send the save and then the on-air update with only the changed value',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Enduro em andamento',
        fields: { state: { kind: 'literal', value: 'green' } },
      },
      {
        type: 'updateInstanceData',
        instanceId: idOfTheInstanceTakenFromTheItem,
        data: { state: 'green' },
        takeTimeFieldKeys: [],
      },
    ]);
    expect(
      timesClosedAfterTheSaveWasSent + timesClosedBeforeTheOnAirUpdateWasAnswered,
      'the panel must stay open until the server has accepted both commands',
    ).toBe(0);
    await waitFor(() => {
      expect(
        onClose,
        'the panel must ask to be closed once both commands were accepted',
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('saves a cleared field as "no value" and sends null on air, which takes it off', async () => {
    // Arrange: the clock on air showing the leader's 7 laps, its item open in the editor.
    const { fakeServer } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItemWithSevenLaps(),
    );

    // Act: clear the laps and press "Atualizar no ar"; the server accepts the save.
    pressButton(`Limpar ${raceClockLapsLabel}`);
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);

    // Assert: the item stores a literal null (the update command cannot remove a key),
    // and the instance gets null, which the server reads as "remove this field".
    expect(
      fakeServer.listCommandsReceived(),
      'cleared laps must be saved as no value and taken off air',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { lapsCompletedByLeader: { kind: 'literal', value: null } },
      },
      {
        type: 'updateInstanceData',
        instanceId: idOfTheInstanceTakenFromTheItem,
        data: { lapsCompletedByLeader: null },
        takeTimeFieldKeys: [],
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('sends only the save when the label alone was changed, and asks to be closed', async () => {
    // Arrange: the endurance start clock on air, its item open in the editor.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );

    // Act: change the label only, press "Atualizar no ar", and the server accepts.
    typeIntoField('Rótulo', 'Largada — Enduro de Resistência');
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: a label is a thing of the rundown, not of the air: no on-air update is
    // sent, and the panel closes after the save alone.
    await waitFor(() => {
      expect(onClose, 'the panel must ask to be closed after the save').toHaveBeenCalledTimes(1);
    });
    expect(
      fakeServer.listCommandsReceived(),
      'a change of label must not send anything to the instance on air',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Largada — Enduro de Resistência',
      },
    ]);
  });

  it('saves a field switched to "filled at the take" but never sends it on air', async () => {
    // Arrange: a clock on air whose item stores a number as its reference moment.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItemSavedWithTheMomentOfTheSave(),
    );

    // Act: switch the reference moment to "the moment of the take", press "Atualizar no
    // ar", and the server accepts the save.
    chooseOptionInDropdown(
      `Como preencher ${raceClockReferenceMomentLabel}`,
      'Momento da entrada no ar',
    );
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the item now says "stamp at the take", for its next take. The clock on air
    // is not touched: stamping a new moment now would restart a running clock.
    await waitFor(() => {
      expect(onClose, 'the panel must ask to be closed after the save').toHaveBeenCalledTimes(1);
    });
    expect(
      fakeServer.listCommandsReceived(),
      'a field left to the take must be saved in the item and not sent on air',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { referenceWallClockMs: { kind: 'takeTime' } },
      },
    ]);
  });

  it('sends nothing and asks to be closed when nothing was changed', async () => {
    // Arrange: the endurance start clock on air, its item open and untouched.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );

    // Act: press "Atualizar no ar" straight away.
    pressButton('Atualizar no ar');

    // Assert: nothing to save and nothing to change on air, so the panel just closes.
    await waitFor(() => {
      expect(onClose, 'a press with no change must still close the panel').toHaveBeenCalledTimes(1);
    });
    expect(
      fakeServer.listCommandsReceived(),
      'a press with no change must not send any command',
    ).toEqual([]);
  });
});

describe('a press of "Salvar item" on an item that is on air', () => {
  it('sends only the save, leaving the instance on air as it is', async () => {
    // Arrange: the endurance start clock on air, its item open in the editor.
    const { fakeServer, onClose } = renderItemEditorPanelForItemOnAir(
      buildEnduranceStartClockItem(),
    );

    // Act: raise the green flag, press "Salvar item", and the server accepts.
    chooseOptionInDropdown('Bandeira', 'Verde');
    await pressSaveAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the item is saved for its next take; the air was not asked to change.
    await waitFor(() => {
      expect(onClose, 'the panel must ask to be closed after the save').toHaveBeenCalledTimes(1);
    });
    expect(
      fakeServer.listCommandsReceived(),
      '"Salvar item" must never send an on-air update',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { state: { kind: 'literal', value: 'green' } },
      },
    ]);
  });
});
