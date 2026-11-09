/**
 * How a car group's fields stand in the form, and what a car pick writes (apps/control)
 *
 * What this module is for:
 *   The item editor shows one picker per car group (BAJAOVRLAY-66) in place of the car's
 *   fields, yet the form still holds every field's own kind and binding, exactly as before,
 *   so saving, checking and the server see nothing new. These pure functions read whether
 *   a group's fields agree on one car (to open an item grouped or split), and write the
 *   per-field bindings of a pick.
 *
 * What these tests prove:
 *   - Fields that follow one car by number agree on that car; fields that follow one place
 *     agree on that place; fields all typed agree on "typed by hand".
 *   - Fields that follow different cars disagree as "different cars"; fields of which one
 *     reads something else (another path, another source, a transform, frozen among
 *     live ones) disagree as "not one pick".
 *   - The way a group opens: by number, by place, typed, nothing chosen yet (a new item)
 *     or separate (any disagreement).
 *   - A pick by number writes each field's binding to its own meaning of that car; a pick
 *     by place writes the place's paths, the gap of the car behind its interval.
 *
 * What these tests deliberately do not cover:
 *   - Turning "Campos separados" off, and the pick a group shows;
 *     carGroupChoiceWhileEditing.test.ts.
 *   - The picker on screen and what a save sends; ItemEditorPanelCarGroups.test.tsx.
 *   - Reading the groups from a manifest; carGroupsOfManifest.test.ts in packages/shared.
 */
import battleCardManifest from '@bajaovrlay/battle-card/battle-card.ograf.json';
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import {
  buildBindingValuesOfCarPick,
  chooseCarGroupWayAtOpening,
  readAgreementOfCarGroupFields,
} from './carGroupChoice';
import {
  buildFieldsOfTheCarAheadOnCar31,
  buildFieldsOfTheCarAheadTypedAsCar47,
  buildLiveBinding,
  fillBattleCardFormFrom,
  readBattleCardGroup,
  simulatorId,
} from './carGroupsOfTheBattleCard.testSupport';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';

describe('readAgreementOfCarGroupFields', () => {
  // Each row is one way the car ahead's five fields may have been stored.
  const agreementScenarios = [
    {
      // The leaders' battle card as BAJAOVRLAY-47 stored it: one car, field by field.
      name: 'agrees on car 31 when the five fields follow car 31 by number',
      fields: buildFieldsOfTheCarAheadOnCar31(),
      expected: {
        status: 'oneCarPick',
        pick: { pickedBy: 'number', sourceId: simulatorId, carNumberText: '31', isLive: true },
      },
    },
    {
      // What "Disputa pela 2ª posição" writes for the car ahead.
      name: 'agrees on the 2nd place when the five fields follow the 2nd place',
      fields: {
        aheadPosition: buildLiveBinding('entries.1.position'),
        aheadCarNumber: buildLiveBinding('entries.1.carNumber'),
        aheadTeamName: buildLiveBinding('entries.1.teamName'),
        aheadSchoolName: buildLiveBinding('entries.1.schoolName'),
        aheadLaps: buildLiveBinding('entries.1.laps'),
      },
      expected: {
        status: 'oneCarPick',
        pick: { pickedBy: 'place', sourceId: simulatorId, placeNumber: 2, isLive: true },
      },
    },
    {
      // A card typed by hand for a race with no timing source.
      name: 'agrees on "typed by hand" when the five fields are typed',
      fields: buildFieldsOfTheCarAheadTypedAsCar47(),
      expected: { status: 'typed', isAnythingTyped: true },
    },
    {
      // The mistake the picker exists to prevent: the laps of another car.
      name: 'disagrees as "different cars" when the laps follow car 25',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadLaps: buildLiveBinding('entryOfCar.laps', 25),
      },
      expected: { status: 'differentCars' },
    },
    {
      // A field typed among bound ones is no single pick of the source.
      name: 'disagrees as "not one pick" when one field is typed among bound ones',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadTeamName: { kind: 'literal', value: 'Acauã Baja' },
      },
      expected: { status: 'notOnePick' },
    },
    {
      // A field reading another field of the car is not what the group says it shows.
      name: 'disagrees as "not one pick" when the team field reads the school',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadTeamName: buildLiveBinding('entryOfCar.schoolName', 31),
      },
      expected: { status: 'notOnePick' },
    },
    {
      // One field frozen at the take and the others live: two choices, not one.
      name: 'disagrees as "not one pick" when one field is frozen and the others live',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadLaps: { ...buildLiveBinding('entryOfCar.laps', 31), isLive: false },
      },
      expected: { status: 'notOnePick' },
    },
    {
      // Car 31 on the simulator and on the official timing are two choices, even for one
      // car: one picker can show only one source.
      name: 'disagrees as "not one pick" when one field reads car 31 on another source',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadTeamName: {
          ...buildLiveBinding('entryOfCar.teamName', 31),
          sourceId: 'cronometragem-oficial',
        },
      },
      expected: { status: 'notOnePick' },
    },
    {
      // A pick writes no transform, so grouping this field would drop its trimText.
      name: 'disagrees as "not one pick" when one field of car 31 has a transform',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadTeamName: { ...buildLiveBinding('entryOfCar.teamName', 31), transformId: 'trimText' },
      },
      expected: { status: 'notOnePick' },
    },
  ];

  it.each(agreementScenarios)('$name', ({ fields, expected }) => {
    // Arrange: the battle card's form filled from the row's fields, and its car ahead.
    const formValues = fillBattleCardFormFrom(fields as ItemFields);
    const carAhead = readBattleCardGroup('ahead');

    // Act: read whether the car ahead's fields agree.
    const agreement = readAgreementOfCarGroupFields(carAhead, formValues);

    // Assert: the agreement the row expects.
    expect(agreement, 'the five fields must be read as the row says').toEqual(expected);
  });
});

describe('chooseCarGroupWayAtOpening', () => {
  const openingScenarios = [
    // An item stored by BAJAOVRLAY-47 opens grouped, its one car shown.
    {
      name: 'opens by number for one car by number',
      fields: buildFieldsOfTheCarAheadOnCar31(),
      expected: 'carNumber',
    },
    // A mixed item opens with its fields separate, so nothing is lost.
    {
      name: 'opens separate for fields on different cars',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadLaps: buildLiveBinding('entryOfCar.laps', 25),
      },
      expected: 'separate',
    },
    // A card typed by hand opens typed by hand.
    {
      name: 'opens typed for typed fields',
      fields: buildFieldsOfTheCarAheadTypedAsCar47(),
      expected: 'typed',
    },
  ];

  it.each(openingScenarios)('$name', ({ fields, expected }) => {
    // Arrange: the battle card's form filled from the row's fields.
    const formValues = fillBattleCardFormFrom(fields as ItemFields);

    // Act: choose how the car ahead opens.
    const way = chooseCarGroupWayAtOpening(readBattleCardGroup('ahead'), formValues);

    // Assert: the way the row expects.
    expect(way, 'the car ahead must open as the row says').toBe(expected);
  });

  it('opens with nothing chosen for a new item', () => {
    // Arrange: a new battle card's form, nothing typed and nothing bound.
    const description = describeSchemaFormFromDataSchema(battleCardManifest.schema);
    const formValues = buildEmptySchemaFormValues(description, {});

    // Act: choose how the car ahead opens.
    const way = chooseCarGroupWayAtOpening(readBattleCardGroup('ahead'), formValues);

    // Assert: the picker waits for the operator: "Carro da frente: [ escolher ]".
    expect(way, 'a new item asks how to choose the car').toBe('notChosen');
  });
});

describe('buildBindingValuesOfCarPick', () => {
  it("writes car 47's own field into each field of the car ahead", () => {
    // Arrange: car 47 picked by number on the simulator, live.
    const pick = {
      pickedBy: 'number' as const,
      sourceId: simulatorId,
      carNumberText: '47',
      isLive: true,
    };

    // Act: write the car ahead's bindings.
    const bindingValues = buildBindingValuesOfCarPick(readBattleCardGroup('ahead'), pick);

    // Assert: each field reads its own meaning of car 47, and nothing else is set.
    expect(
      Object.fromEntries(
        Object.entries(bindingValues).map(([fieldKey, value]) => [fieldKey, value.pathKey]),
      ),
      'each field must read its own field of the car',
    ).toEqual({
      aheadPosition: 'positions:entryOfCar.position',
      aheadCarNumber: 'positions:entryOfCar.carNumber',
      aheadTeamName: 'positions:entryOfCar.teamName',
      aheadSchoolName: 'positions:entryOfCar.schoolName',
      aheadLaps: 'positions:entryOfCar.laps',
    });
    expect(bindingValues.aheadTeamName, 'the team of car 47, live, with no transform').toEqual({
      sourceId: simulatorId,
      pathKey: 'positions:entryOfCar.teamName',
      carNumberText: '47',
      isLive: true,
      transformId: '',
      transformParameterText: '',
      thenTransformId: '',
      thenTransformParameterText: '',
    });
  });

  it("writes the 3rd place's paths into the car behind, the gap its interval", () => {
    // Arrange: the 3rd place on the simulator, frozen at the take.
    const pick = {
      pickedBy: 'place' as const,
      sourceId: simulatorId,
      placeNumber: 3,
      isLive: false,
    };

    // Act: write the car behind's bindings.
    const bindingValues = buildBindingValuesOfCarPick(readBattleCardGroup('behind'), pick);

    // Assert: the third entry's fields, the gap the interval, all frozen and with no number.
    expect(
      Object.fromEntries(
        Object.entries(bindingValues).map(([fieldKey, value]) => [fieldKey, value.pathKey]),
      ),
      'each field must read its own field of the 3rd place',
    ).toEqual({
      behindPosition: 'positions:entries.2.position',
      behindCarNumber: 'positions:entries.2.carNumber',
      behindTeamName: 'positions:entries.2.teamName',
      behindSchoolName: 'positions:entries.2.schoolName',
      behindLaps: 'positions:entries.2.laps',
      gapMs: 'positions:entries.2.intervalMs',
    });
    expect(
      Object.values(bindingValues).every(
        (value) => !value.isLive && value.carNumberText === '' && value.sourceId === simulatorId,
      ),
      'every field must be frozen, on the simulator, with no car number',
    ).toBe(true);
  });
});
