/**
 * A car pick read from, and written into, a stored item without the item editor (apps/control)
 *
 * What this module is for:
 *   The console's "Escolher carros" (BAJAOVRLAY-82) picks the battle card's two cars
 *   without opening the item editor. It must store exactly what the editor's car picker
 *   stores for the same pick, so it reads the item's fields the way the editor opens them
 *   and builds each field's binding with the editor's own functions
 *   (carGroupChoice.ts), checked by the rules a save runs (bindingFormValue.ts).
 *
 * What these tests prove:
 *   - A pick of car 47 by number writes, field by field, the bindings the editor's picker
 *     writes for car 47: each field its own meaning of that car, one source, live.
 *   - "Disputa pela 3ª posição" writes the car ahead at the 3rd place and the car behind
 *     at the 4th, by place.
 *   - The source and "Ao vivo" / "Congelado" the item already has are read back from its
 *     first field reading the positions, so a new pick keeps them; an item typed by hand
 *     has none to read.
 *   - The pick an item stores is read back (by number or by place), and an item whose
 *     fields do not follow one car has none.
 *   - A car number that is not a whole number is refused with the editor's pt-BR message.
 *
 * What these tests deliberately do not cover:
 *   - Which cars exist in the positions: the console checks that before it builds
 *     anything (features/quickCarPick).
 *   - Sending the save: the console's tests (QuickCarPickForm.test.tsx).
 */
import battleCardManifest from '@bajaovrlay/battle-card/battle-card.ograf.json';
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildItemFieldsOfCarPicks,
  readCarPickStoredInItemFields,
  readSourceAndWhenOfCarGroupsInItemFields,
} from './carGroupPicksOfStoredItem';
import {
  buildFieldsOfTheCarAheadOnCar31,
  buildFieldsOfTheCarAheadTypedAsCar47,
  buildLiveBinding,
  readBattleCardGroup,
  simulatorId,
} from './carGroupsOfTheBattleCard.testSupport';

const battleCardDataSchema = battleCardManifest.schema;

/** The car behind's six fields, each frozen at the take on car 52 chosen by number. */
function buildFieldsOfTheCarBehindFrozenOnCar52(): ItemFields {
  const frozenBindingOfCar52 = (path: string) => ({ ...buildLiveBinding(path, 52), isLive: false });
  return {
    behindPosition: frozenBindingOfCar52('entryOfCar.position'),
    behindCarNumber: frozenBindingOfCar52('entryOfCar.carNumber'),
    behindTeamName: frozenBindingOfCar52('entryOfCar.teamName'),
    behindSchoolName: frozenBindingOfCar52('entryOfCar.schoolName'),
    behindLaps: frozenBindingOfCar52('entryOfCar.laps'),
    gapMs: frozenBindingOfCar52('entryOfCar.intervalMs'),
  };
}

describe('buildItemFieldsOfCarPicks', () => {
  it('writes car 47 picked by number into every field of the car ahead, as the editor does', () => {
    // Arrange: the battle card's car ahead, and car 47 picked by number on the simulator, live.
    const carGroupAhead = readBattleCardGroup('ahead');

    // Act: build the item fields of that one pick.
    const result = buildItemFieldsOfCarPicks(battleCardDataSchema, [
      {
        carGroup: carGroupAhead,
        pick: { pickedBy: 'number', sourceId: simulatorId, carNumberText: '47', isLive: true },
      },
    ]);

    // Assert: each field reads its own meaning of car 47, and nothing else is written.
    expect(result, 'each field of the car ahead must read its own value of car 47').toEqual({
      status: 'fields',
      fields: {
        aheadPosition: buildLiveBinding('entryOfCar.position', 47),
        aheadCarNumber: buildLiveBinding('entryOfCar.carNumber', 47),
        aheadTeamName: buildLiveBinding('entryOfCar.teamName', 47),
        aheadSchoolName: buildLiveBinding('entryOfCar.schoolName', 47),
        aheadLaps: buildLiveBinding('entryOfCar.laps', 47),
      },
    });
  });

  it('writes the battle for 3rd place as the car ahead at the 3rd place and the car behind at the 4th', () => {
    // Arrange: both cars of the battle card, picked by place: the 3rd ahead, the 4th behind.
    const carGroupAhead = readBattleCardGroup('ahead');
    const carGroupBehind = readBattleCardGroup('behind');

    // Act: build the item fields of the two picks together.
    const result = buildItemFieldsOfCarPicks(battleCardDataSchema, [
      {
        carGroup: carGroupAhead,
        pick: { pickedBy: 'place', sourceId: simulatorId, placeNumber: 3, isLive: true },
      },
      {
        carGroup: carGroupBehind,
        pick: { pickedBy: 'place', sourceId: simulatorId, placeNumber: 4, isLive: true },
      },
    ]);

    // Assert: the car ahead reads the 3rd place (index 2), the car behind the 4th (index 3).
    expect(result, 'the two cars must follow the 3rd and the 4th places').toEqual({
      status: 'fields',
      fields: {
        aheadPosition: buildLiveBinding('entries.2.position'),
        aheadCarNumber: buildLiveBinding('entries.2.carNumber'),
        aheadTeamName: buildLiveBinding('entries.2.teamName'),
        aheadSchoolName: buildLiveBinding('entries.2.schoolName'),
        aheadLaps: buildLiveBinding('entries.2.laps'),
        behindPosition: buildLiveBinding('entries.3.position'),
        behindCarNumber: buildLiveBinding('entries.3.carNumber'),
        behindTeamName: buildLiveBinding('entries.3.teamName'),
        behindSchoolName: buildLiveBinding('entries.3.schoolName'),
        behindLaps: buildLiveBinding('entries.3.laps'),
        gapMs: buildLiveBinding('entries.3.intervalMs'),
      },
    });
  });

  it('refuses a car number that is not a whole number, with the editor’s message', () => {
    // Arrange: the car ahead, with "4a" where a number belongs.
    const carGroupAhead = readBattleCardGroup('ahead');

    // Act: try to build the fields of that pick.
    const result = buildItemFieldsOfCarPicks(battleCardDataSchema, [
      {
        carGroup: carGroupAhead,
        pick: { pickedBy: 'number', sourceId: simulatorId, carNumberText: '4a', isLive: true },
      },
    ]);

    // Assert: a problem in pt-BR, naming the first field it found wrong.
    expect(result.status, 'a mistyped number must be refused, not stored').toBe('problem');
    expect(
      result.status === 'problem' ? result.message : '',
      'the message must be the editor’s own about the car number',
    ).toContain('número do carro');
  });
});

describe('readSourceAndWhenOfCarGroupsInItemFields', () => {
  it('reads the source and the frozen choice the car behind already has', () => {
    // Arrange: an item whose car behind is frozen on car 52 of the simulator.
    const carGroups = [readBattleCardGroup('ahead'), readBattleCardGroup('behind')];
    const itemFields = buildFieldsOfTheCarBehindFrozenOnCar52();

    // Act: read the source and "Ao vivo / Congelado" of the item's cars.
    const sourceAndWhen = readSourceAndWhenOfCarGroupsInItemFields(carGroups, itemFields);

    // Assert: the simulator, frozen, as stored; a new pick keeps both.
    expect(sourceAndWhen, 'the stored source and the frozen choice must be read back').toEqual({
      sourceId: simulatorId,
      isLive: false,
    });
  });

  it('takes the source only from a field reading the positions, not from one reading the standings', () => {
    // Arrange: the car ahead's school read from the rehearsal replay's standings (bound by
    // hand, field by field), and the car behind frozen on car 52 of the simulator's positions.
    const carGroups = [readBattleCardGroup('ahead'), readBattleCardGroup('behind')];
    const itemFields: ItemFields = {
      aheadSchoolName: {
        kind: 'binding',
        sourceId: 'reproducao-ensaio',
        shapeKey: 'standings',
        path: 'entries.0.schoolName',
        isLive: true,
      },
      ...buildFieldsOfTheCarBehindFrozenOnCar52(),
    };

    // Act: read the source and "Ao vivo / Congelado" of the item's cars.
    const sourceAndWhen = readSourceAndWhenOfCarGroupsInItemFields(carGroups, itemFields);

    // Assert: the simulator, frozen, from the first field that reads the positions.
    expect(
      sourceAndWhen,
      'a field reading another shape must not decide where the cars are picked',
    ).toEqual({ sourceId: simulatorId, isLive: false });
  });

  it('reads nothing from an item whose cars are typed by hand', () => {
    // Arrange: the car ahead typed as car 47, and nothing stored for the car behind.
    const carGroups = [readBattleCardGroup('ahead'), readBattleCardGroup('behind')];
    const itemFields = buildFieldsOfTheCarAheadTypedAsCar47();

    // Act: read the source of the item's cars.
    const sourceAndWhen = readSourceAndWhenOfCarGroupsInItemFields(carGroups, itemFields);

    // Assert: there is none; the console then chooses one itself.
    expect(sourceAndWhen, 'a typed car reads no source').toBeUndefined();
  });
});

describe('readCarPickStoredInItemFields', () => {
  it('reads car 31 picked by number back from the stored bindings', () => {
    // Arrange: the car ahead stored on car 31 by number, live.
    const carGroupAhead = readBattleCardGroup('ahead');

    // Act: read the pick the item stores for the car ahead.
    const pick = readCarPickStoredInItemFields(
      carGroupAhead,
      battleCardDataSchema,
      buildFieldsOfTheCarAheadOnCar31(),
    );

    // Assert: car 31 by number, on the simulator, live.
    expect(pick, 'the stored pick must read as car 31 by number').toEqual({
      pickedBy: 'number',
      sourceId: simulatorId,
      carNumberText: '31',
      isLive: true,
    });
  });

  it('reads no pick when the car is typed by hand', () => {
    // Arrange: the car ahead typed as car 47.
    const carGroupAhead = readBattleCardGroup('ahead');

    // Act: read the pick the item stores for the car ahead.
    const pick = readCarPickStoredInItemFields(
      carGroupAhead,
      battleCardDataSchema,
      buildFieldsOfTheCarAheadTypedAsCar47(),
    );

    // Assert: there is none, so the console starts with the box empty.
    expect(pick, 'a typed car is no pick').toBeUndefined();
  });
});
