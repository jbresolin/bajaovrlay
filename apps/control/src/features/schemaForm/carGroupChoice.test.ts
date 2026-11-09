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
 *     reads something else (the library, another path) disagree as "not one pick".
 *   - The way a group opens: by number, by place, typed, nothing chosen yet (a new item)
 *     or separate (any disagreement).
 *   - A pick by number writes each field's binding to its own meaning of that car; a pick
 *     by place writes the place's paths, the gap of the car behind its interval.
 *
 * What these tests deliberately do not cover:
 *   - The picker on screen and what a save sends; ItemEditorPanelCarGroups.test.tsx.
 *   - Reading the groups from a manifest; carGroupsOfManifest.test.ts in packages/shared.
 */
import battleCardManifest from '@bajaovrlay/battle-card/battle-card.ograf.json';
import {
  type BindingFieldValue,
  type CarGroup,
  type ItemFields,
  readCarGroupsOfManifest,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { buildSchemaFormValuesFromItemFields } from './buildSchemaFormValuesFromItemFields';
import {
  buildBindingValuesOfCarPick,
  chooseCarGroupWayAtOpening,
  readAgreementOfCarGroupFields,
} from './carGroupChoice';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormValues } from './schemaFormValues';

const simulatorId = 'simulador-enduro';

/** One of the battle card's groups, read from its real manifest ("ahead" or "behind"). */
function readBattleCardGroup(groupId: string): CarGroup {
  const reading = readCarGroupsOfManifest(battleCardManifest);
  const carGroup =
    reading.status === 'groups'
      ? reading.carGroups.find((candidate) => candidate.id === groupId)
      : undefined;
  if (carGroup === undefined) {
    throw new Error(`the battle card's manifest must declare the group ${groupId}`);
  }
  return carGroup;
}

/** A live binding of one positions path on the simulator, a car number when one is given. */
function buildLiveBinding(path: string, carNumber?: number): BindingFieldValue {
  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: simulatorId,
    shapeKey: 'positions',
    path,
    isLive: true,
  };
  if (carNumber !== undefined) {
    binding.carNumber = carNumber;
  }
  return binding;
}

/** The car ahead's five fields, each on car 31 chosen by number, as BAJAOVRLAY-47 stored them. */
function buildFieldsOfTheCarAheadOnCar31(): ItemFields {
  return {
    aheadPosition: buildLiveBinding('entryOfCar.position', 31),
    aheadCarNumber: buildLiveBinding('entryOfCar.carNumber', 31),
    aheadTeamName: buildLiveBinding('entryOfCar.teamName', 31),
    aheadSchoolName: buildLiveBinding('entryOfCar.schoolName', 31),
    aheadLaps: buildLiveBinding('entryOfCar.laps', 31),
  };
}

/** The car ahead typed by hand: car 47 of Carnaúba Baja (UFERSA), 6th with 33 laps. */
function buildFieldsOfTheCarAheadTypedAsCar47(): ItemFields {
  return {
    aheadPosition: { kind: 'literal', value: 6 },
    aheadCarNumber: { kind: 'literal', value: 47 },
    aheadTeamName: { kind: 'literal', value: 'Carnaúba Baja' },
    aheadSchoolName: { kind: 'literal', value: 'UFERSA' },
    aheadLaps: { kind: 'literal', value: 33 },
  };
}

/** The battle card's form filled from these stored fields, as the item editor fills it. */
function fillBattleCardFormFrom(fields: ItemFields): SchemaFormValues {
  const description = describeSchemaFormFromDataSchema(battleCardManifest.schema);
  return buildSchemaFormValuesFromItemFields(description, fields).formValues;
}

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
