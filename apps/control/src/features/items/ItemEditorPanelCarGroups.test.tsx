/**
 * Choosing a car once for all of its fields (apps/control)
 *
 * What this module is for:
 *   The battle card asked for the same car five times, once per field, and nothing
 *   stopped the operator from picking a different car in each (BAJAOVRLAY-66). A graphic
 *   now declares its car groups, and the item editor shows one picker per group in place
 *   of its fields: by number ("Carro 47"), by place ("2º lugar"; for the battle card,
 *   "Disputa pela 2ª posição" sets both cars), or typed by hand, with "Ao vivo" or
 *   "Congelado" chosen once. "Campos separados" shows the old field-by-field editing. The
 *   picker writes the same bindings the fields had, so saved items, the resolver and the
 *   renderer see nothing new.
 *
 * What these tests prove (the battle card's real manifest, the simulator at lap 34):
 *   - Choosing car 47 fills the car ahead's five fields with bindings to car 47, live.
 *   - "Disputa pela 2ª posição" fills both cars by place: the 2nd ahead, the 3rd behind,
 *     the gap the 3rd place's interval.
 *   - "Congelado na entrada", chosen once, freezes all five fields of the car.
 *   - Typed by hand shows the car's fields; switching to a pick and back keeps the values
 *     typed.
 *   - An item saved before this change whose fields follow one car opens grouped; one
 *     whose fields follow different cars opens with "Campos separados" on and a line
 *     saying so, the other car still grouped.
 *   - Turning "Campos separados" off on that car keeps it on, with its line and every
 *     field still shown, so mixed bindings a save would store are never hidden; picking
 *     a car from there groups the fields and saves that car in each.
 *   - A save refused for a car not chosen yet ties the group's message to its picker
 *     (announced, the picker marked invalid and described by the message).
 *   - Two picks save exactly the eleven bindings the leaders' battle card was stored with
 *     field by field.
 *
 * What these tests deliberately do not cover:
 *   - Which fields agree on one car, rule by rule; carGroupChoice.test.ts.
 *   - The resolver reading a car by place; bindingResolutionCarPickedByPlace.test.ts in
 *     packages/shared. The card on the renderer: e2e/battleCardForSecondPlace.e2e.ts and
 *     step 4 of e2e/podiumBattleQrWalk.e2e.ts.
 */
import type { BindingFieldValue, Item } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { seededSimulatorId } from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  buildBattleCardOfTheLeadersItem,
  buildSlicesWithTheBattleCardOfTheLeaders,
} from './battleCardOfTheLeaders.testSupport';
import {
  chooseGraphicInTheEditor,
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';

/** The battle card, as the editor's "Gráfico" dropdown names it (its manifest's name). */
const battleCardGraphicName = 'Disputa de posição';

/** The editor for a new battle card item, on a page that knows the simulator at lap 34. */
function renderNewBattleCardItemEditor() {
  const editorOnFakeServer = renderItemEditorPanelOnFakeServerWithSlices(null, {
    ...buildSlicesWithTheBattleCardOfTheLeaders(),
    items: [],
  });
  chooseGraphicInTheEditor(battleCardGraphicName);
  typeIntoField('Rótulo', 'Disputa — escolhida uma vez');
  return editorOnFakeServer;
}

/** The editor opened on a stored battle card item. */
function renderEditorOnStoredBattleCard(item: Item) {
  return renderItemEditorPanelOnFakeServerWithSlices(item, {
    ...buildSlicesWithTheBattleCardOfTheLeaders(),
    items: [item],
  });
}

/** Picks one car of the card by its number, as the operator does: the way, then the number. */
function pickCarByNumber(groupLabel: string, carNumber: number): void {
  chooseOptionInDropdown(`Como escolher ${groupLabel}`, 'Pelo número do carro');
  typeIntoField(`Número do carro — ${groupLabel}`, String(carNumber));
}

/** The fields of the first command the fake server received (a createItem). */
function readFieldsOfTheFirstCommand(
  fakeServer: ReturnType<typeof renderNewBattleCardItemEditor>['fakeServer'],
): Record<string, unknown> {
  return (fakeServer.listCommandsReceived()[0] as { fields: Record<string, unknown> }).fields;
}

/** A live binding of one positions path on the simulator, with a car number when given. */
function buildExpectedBinding(path: string, carNumber?: number): BindingFieldValue {
  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: seededSimulatorId,
    shapeKey: 'positions',
    path,
    isLive: true,
  };
  if (carNumber !== undefined) {
    binding.carNumber = carNumber;
  }
  return binding;
}

/** The text a dropdown shows as its current choice, found by its accessible name. */
function readChoiceShownInDropdown(dropdownName: string): string {
  return screen.getByRole('combobox', { name: dropdownName }).textContent ?? '';
}

describe('the car picker of the item editor', () => {
  it("fills the car ahead's five fields by choosing car 47 once", async () => {
    // Arrange: a new battle card with its car behind picked as car 25.
    const { fakeServer } = renderNewBattleCardItemEditor();
    pickCarByNumber('Carro de trás', 25);

    // Act: pick car 47 for the car ahead, and save.
    pickCarByNumber('Carro da frente', 47);
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: each of the five fields reads its own field of car 47, live, on the simulator.
    const fields = readFieldsOfTheFirstCommand(fakeServer);
    expect(
      {
        aheadPosition: fields.aheadPosition,
        aheadCarNumber: fields.aheadCarNumber,
        aheadTeamName: fields.aheadTeamName,
        aheadSchoolName: fields.aheadSchoolName,
        aheadLaps: fields.aheadLaps,
      },
      'the five fields of the car ahead must all follow car 47',
    ).toEqual({
      aheadPosition: buildExpectedBinding('entryOfCar.position', 47),
      aheadCarNumber: buildExpectedBinding('entryOfCar.carNumber', 47),
      aheadTeamName: buildExpectedBinding('entryOfCar.teamName', 47),
      aheadSchoolName: buildExpectedBinding('entryOfCar.schoolName', 47),
      aheadLaps: buildExpectedBinding('entryOfCar.laps', 47),
    });
  });

  it('fills both cars by place with "Disputa pela 2ª posição"', async () => {
    // Arrange: a new battle card.
    const { fakeServer } = renderNewBattleCardItemEditor();

    // Act: choose the battle for 2nd place, and save.
    chooseOptionInDropdown('Disputa pela posição', 'Disputa pela 2ª posição');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: both cars chosen by place; the car ahead is the 2nd, the car behind the 3rd.
    expect(
      readChoiceShownInDropdown('Como escolher Carro de trás'),
      'the car behind is chosen by place too',
    ).toBe('Pelo lugar na corrida');
    expect(readFieldsOfTheFirstCommand(fakeServer), 'eleven bindings by place').toEqual({
      aheadPosition: buildExpectedBinding('entries.1.position'),
      aheadCarNumber: buildExpectedBinding('entries.1.carNumber'),
      aheadTeamName: buildExpectedBinding('entries.1.teamName'),
      aheadSchoolName: buildExpectedBinding('entries.1.schoolName'),
      aheadLaps: buildExpectedBinding('entries.1.laps'),
      behindPosition: buildExpectedBinding('entries.2.position'),
      behindCarNumber: buildExpectedBinding('entries.2.carNumber'),
      behindTeamName: buildExpectedBinding('entries.2.teamName'),
      behindSchoolName: buildExpectedBinding('entries.2.schoolName'),
      behindLaps: buildExpectedBinding('entries.2.laps'),
      gapMs: buildExpectedBinding('entries.2.intervalMs'),
    });
  });

  it('freezes all five fields of the car with one "Congelado na entrada"', async () => {
    // Arrange: a new battle card with car 47 ahead and car 25 behind.
    const { fakeServer } = renderNewBattleCardItemEditor();
    pickCarByNumber('Carro da frente', 47);
    pickCarByNumber('Carro de trás', 25);

    // Act: freeze the car ahead once, and save.
    chooseOptionInDropdown('Quando Carro da frente lê a fonte', 'Congelado na entrada');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the car ahead's five fields frozen, the car behind's still live.
    const fields = readFieldsOfTheFirstCommand(fakeServer) as Record<string, BindingFieldValue>;
    const aheadFieldKeys = [
      'aheadPosition',
      'aheadCarNumber',
      'aheadTeamName',
      'aheadSchoolName',
      'aheadLaps',
    ];
    expect(
      aheadFieldKeys.map((fieldKey) => fields[fieldKey]?.isLive),
      'every field of the car ahead must be frozen',
    ).toEqual([false, false, false, false, false]);
    expect(fields.behindLaps?.isLive, 'the car behind keeps its own choice').toBe(true);
  });

  it('keeps the values typed by hand after switching to a pick and back', () => {
    // Arrange: a new battle card with the car ahead typed by hand, car 47 at 6th.
    renderNewBattleCardItemEditor();
    chooseOptionInDropdown('Como escolher Carro da frente', 'Digitado à mão');
    typeIntoField('Posição do carro da frente', '6');
    typeIntoField('Número do carro da frente', '47');
    typeIntoField('Equipe do carro da frente', 'Carnaúba Baja');

    // Act: pick a car by number, then go back to typing by hand.
    pickCarByNumber('Carro da frente', 31);
    chooseOptionInDropdown('Como escolher Carro da frente', 'Digitado à mão');

    // Assert: what was typed is still there.
    expect(
      [
        screen.getByLabelText<HTMLInputElement>('Posição do carro da frente').value,
        screen.getByLabelText<HTMLInputElement>('Número do carro da frente').value,
        screen.getByLabelText<HTMLInputElement>('Equipe do carro da frente').value,
      ],
      'the values typed by hand must be kept under the pick',
    ).toEqual(['6', '47', 'Carnaúba Baja']);
  });
});

describe('a battle card saved before the car picker', () => {
  it('opens grouped when the fields of each car follow one car', () => {
    // Arrange: the leaders' battle card, each car's fields stored one by one on car 31 and 38.
    const leadersItem = buildBattleCardOfTheLeadersItem();

    // Act: open it in the editor.
    renderEditorOnStoredBattleCard(leadersItem);

    // Assert: both cars shown as one pick by number, and no field-by-field controls.
    expect(
      [
        readChoiceShownInDropdown('Como escolher Carro da frente'),
        readChoiceShownInDropdown('Como escolher Carro de trás'),
      ],
      'both cars open as one pick by number',
    ).toEqual(['Pelo número do carro', 'Pelo número do carro']);
    expect(
      [
        screen.getByLabelText<HTMLInputElement>('Número do carro — Carro da frente').value,
        screen.getByLabelText<HTMLInputElement>('Número do carro — Carro de trás').value,
      ],
      'the cars are 31 and 38',
    ).toEqual(['31', '38']);
    expect(
      screen.queryByRole('combobox', { name: 'Como preencher Voltas do carro da frente' }),
      'no field of a grouped car is edited one by one',
    ).toBeNull();
  });

  it('opens with "Campos separados" on, and says why, when one car\'s fields follow two cars', () => {
    // Arrange: the leaders' battle card with the car ahead's laps read from car 25.
    const mixedItem = buildBattleCardOfTheLeadersItem();
    mixedItem.fields.aheadLaps = buildExpectedBinding('entryOfCar.laps', 25);

    // Act: open it in the editor.
    renderEditorOnStoredBattleCard(mixedItem);

    // Assert: the car ahead split with its line; the car behind still grouped.
    expect(
      screen.getByRole('switch', { name: 'Campos separados — Carro da frente' }),
      'the car ahead opens with its fields separate',
    ).toBeChecked();
    expect(
      screen.getByText(
        'Os campos de Carro da frente leem carros diferentes, por isso estão separados.',
      ),
      'a line says why the fields are separate',
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Como preencher Voltas do carro da frente' }),
      'each field of the car ahead is edited one by one',
    ).toBeVisible();
    expect(
      screen.getByRole('switch', { name: 'Campos separados — Carro de trás' }),
      'the car behind stays grouped',
    ).not.toBeChecked();
  });
});

describe('a car whose fields follow two cars, with "Campos separados" turned off', () => {
  /** The leaders' battle card with the car ahead's laps read from car 25, open in the editor. */
  function renderEditorOnTheMixedBattleCard() {
    const mixedItem = buildBattleCardOfTheLeadersItem();
    mixedItem.fields.aheadLaps = buildExpectedBinding('entryOfCar.laps', 25);
    return { mixedItem, ...renderEditorOnStoredBattleCard(mixedItem) };
  }

  it('stays separate, with its line and every field shown, until a car is picked', () => {
    // Arrange: the mixed card open, the car ahead split.
    renderEditorOnTheMixedBattleCard();
    const separateSwitch = screen.getByRole('switch', {
      name: 'Campos separados — Carro da frente',
    });

    // Act: turn "Campos separados" off.
    fireEvent.click(separateSwitch);

    // Assert: still on, still saying why, the laps of car 25 still in their own row.
    expect(separateSwitch, 'the switch stays on while the fields disagree').toBeChecked();
    expect(
      screen.getByText(
        'Os campos de Carro da frente leem carros diferentes, por isso estão separados.',
      ),
      'the line still says why',
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Como preencher Voltas do carro da frente' }),
      'the field a save would store on car 25 stays on screen',
    ).toBeVisible();
  });

  it('groups the fields once a car is picked, and saves that car in each', async () => {
    // Arrange: the mixed card open, the car ahead split.
    const { mixedItem, fakeServer } = renderEditorOnTheMixedBattleCard();

    // Act: pick car 31 for the car ahead from the split group, and save.
    pickCarByNumber('Carro da frente', 31);
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: grouped again, and the laps saved on car 31 like the other four fields.
    expect(
      screen.getByRole('switch', { name: 'Campos separados — Carro da frente' }),
      'a pick turns "Campos separados" off',
    ).not.toBeChecked();
    expect(fakeServer.listCommandsReceived()[0], 'the laps now follow car 31').toEqual({
      type: 'updateItemFields',
      itemId: mixedItem.id,
      fields: { aheadLaps: buildExpectedBinding('entryOfCar.laps', 31) },
    });
  });
});

describe('the message of a car not chosen yet', () => {
  it('is announced and tied to the picker of that car', async () => {
    // Arrange: a new battle card with only the car behind picked.
    const { fakeServer } = renderNewBattleCardItemEditor();
    pickCarByNumber('Carro de trás', 25);

    // Act: try to save.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    const message = await screen.findByRole('alert');

    // Assert: the message names the car, and the car's picker is invalid and described by it.
    const picker = screen.getByRole('combobox', { name: 'Como escolher Carro da frente' });
    expect(message, 'the message says which car to choose').toHaveTextContent(
      'Escolha como preencher Carro da frente.',
    );
    expect(picker, 'the picker is marked invalid').toHaveAttribute('aria-invalid', 'true');
    expect(picker, 'the picker is described by the message').toHaveAccessibleDescription(
      'Escolha como preencher Carro da frente.',
    );
    expect(fakeServer.listCommandsReceived(), 'nothing is saved').toEqual([]);
  });
});

describe('what the picker saves', () => {
  it("saves the same eleven bindings the leaders' battle card was stored with field by field", async () => {
    // Arrange: a new battle card, and the leaders' card stored field by field (BAJAOVRLAY-47).
    const { fakeServer } = renderNewBattleCardItemEditor();
    const fieldsStoredFieldByField = buildBattleCardOfTheLeadersItem().fields;

    // Act: two picks, car 31 ahead and car 38 behind, and save.
    pickCarByNumber('Carro da frente', 31);
    pickCarByNumber('Carro de trás', 38);
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: exactly the same fields, so the resolver and the renderer see the same item.
    expect(
      readFieldsOfTheFirstCommand(fakeServer),
      'two picks must save what eleven field-by-field choices saved',
    ).toEqual(fieldsStoredFieldByField);
  });
});

describe('the car picker on a page with no field typed', () => {
  it('asks how to choose each car of a new battle card', () => {
    // Arrange: nothing more than a new battle card.
    renderNewBattleCardItemEditor();

    // Act: nothing; read what the car ahead shows.
    const wayShown = readChoiceShownInDropdown('Como escolher Carro da frente');

    // Assert: "Escolha…", and none of the car's fields on screen yet.
    expect(wayShown, 'a new car waits to be chosen').toBe('Escolha…');
    expect(
      screen.queryByLabelText('Equipe do carro da frente'),
      'the fields stay hidden until a way is chosen',
    ).toBeNull();
  });
});
