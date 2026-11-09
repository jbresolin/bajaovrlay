/**
 * A car group while the operator edits it (apps/control)
 *
 * What this module is for:
 *   The item editor shows one picker per car group (BAJAOVRLAY-66), and "Campos
 *   separados" shows the car's fields one by one. Turning that switch off must not hide
 *   fields that disagree, since a save still stores what they hold; and the picker must
 *   show the pick its fields hold as the agreement reads it.
 *
 * What these tests prove:
 *   - Turning "Campos separados" off groups fields that agree (by number, typed by hand),
 *     and keeps fields that disagree separate (different cars, one typed among bound
 *     ones), so mixed bindings a save would store are never hidden.
 *   - The pick a group shows reads the car number without the spaces around it, as the
 *     agreement does.
 *
 * What these tests deliberately do not cover:
 *   - The agreement rule by rule, how a group opens, what a pick writes;
 *     carGroupChoice.test.ts.
 *   - The switch and the picker on screen; ItemEditorPanelCarGroups.test.tsx.
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { chooseCarGroupWayAfterSeparateFields, readCarPickShownInGroup } from './carGroupChoice';
import {
  buildFieldsOfTheCarAheadOnCar31,
  buildFieldsOfTheCarAheadTypedAsCar47,
  buildLiveBinding,
  fillBattleCardFormFrom,
  readBattleCardGroup,
  simulatorId,
} from './carGroupsOfTheBattleCard.testSupport';

describe('chooseCarGroupWayAfterSeparateFields', () => {
  const turningOffScenarios = [
    // Fields that follow one car show as that car's pick.
    {
      name: 'groups the fields by number when they follow one car',
      fields: buildFieldsOfTheCarAheadOnCar31(),
      expected: 'carNumber',
    },
    // The laps of car 25 among car 31's fields: grouping would hide what a save stores,
    // so the fields stay separate until the operator makes a pick.
    {
      name: 'keeps the fields separate when they follow different cars',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadLaps: buildLiveBinding('entryOfCar.laps', 25),
      },
      expected: 'separate',
    },
    // A field typed among bound ones is no single pick either.
    {
      name: 'keeps the fields separate when one is typed among bound ones',
      fields: {
        ...buildFieldsOfTheCarAheadOnCar31(),
        aheadTeamName: { kind: 'literal', value: 'Acauã Baja' },
      },
      expected: 'separate',
    },
    // Fields all typed show together as typed by hand.
    {
      name: 'groups typed fields as typed by hand',
      fields: buildFieldsOfTheCarAheadTypedAsCar47(),
      expected: 'typed',
    },
  ];

  it.each(turningOffScenarios)('$name', ({ fields, expected }) => {
    // Arrange: the battle card's form filled from the row's fields.
    const formValues = fillBattleCardFormFrom(fields as ItemFields);

    // Act: choose how the car ahead shows once "Campos separados" is turned off.
    const way = chooseCarGroupWayAfterSeparateFields(readBattleCardGroup('ahead'), formValues);

    // Assert: the way the row expects.
    expect(way, 'the car ahead must show as the row says').toBe(expected);
  });
});

describe('readCarPickShownInGroup', () => {
  it('shows the car number without the spaces typed around it', () => {
    // Arrange: car 31 ahead, its first field's number held as " 31 " (typed with spaces).
    const formValues = fillBattleCardFormFrom(buildFieldsOfTheCarAheadOnCar31());
    const firstBinding = formValues.bindings.aheadPosition;
    if (firstBinding === undefined) {
      throw new Error('the form must hold the position binding of the car ahead');
    }
    formValues.bindings.aheadPosition = { ...firstBinding, carNumberText: ' 31 ' };

    // Act: read the pick the car ahead shows.
    const pickShown = readCarPickShownInGroup(readBattleCardGroup('ahead'), formValues, 'number');

    // Assert: "31", the number the agreement reads too.
    expect(pickShown, 'the picker must show car 31 as the agreement reads it').toEqual({
      pickedBy: 'number',
      sourceId: simulatorId,
      carNumberText: '31',
      isLive: true,
    });
  });
});
