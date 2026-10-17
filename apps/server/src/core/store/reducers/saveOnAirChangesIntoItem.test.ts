/**
 * saveOnAirChangesIntoItem: "Salvar no item" (apps/server)
 *
 * What this module is for:
 *   An instance of an item changed on air lists the changed fields in
 *   `fieldsChangedOnAir`, and Camadas offers "Salvar no item". This command writes those
 *   fields, with the values on air now, into the item as typed values (`literal`), so the
 *   next take of the item shows them, and empties the list: the air and the item agree
 *   again. A clock's wall-clock moment needs the operator's choice, carried in
 *   `wallClockFields`: `keepMoment` stores the moment on air as a typed number, so each
 *   take continues that very clock ("Continuar este relógio"); `atTake` stores it as
 *   takeTime, so each take starts the clock when it goes on air ("Começar na entrada no
 *   ar").
 *
 * What these tests prove:
 *   - The listed fields are written as literals with the values on air, the item's other
 *     fields and parts are left as they were, the instance's data is untouched, and its
 *     list is gone. A field cleared on air is stored as a literal null.
 *   - For the race clock's `referenceWallClockMs`, `keepMoment` stores the moment on air
 *     and `atTake` stores takeTime; the reference time is a literal either way.
 *   - The command is refused, with nothing changed, for an instance that is not there, one
 *     put on air by hand before BAJAOVRLAY-37 (no item), one whose item was deleted, and
 *     one with nothing changed on air.
 *
 * What these tests deliberately do not cover:
 *   - Which fields are listed in the first place;
 *     updateInstanceDataFieldsChangedOnAir.test.ts does.
 *   - That only operators may send it; authorizeCommand.test.ts does.
 *   - When the page asks for the clock choice; the Camadas tests in apps/control do.
 */
import type { Instance, Item, SaveOnAirChangesIntoItemCommand } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockData,
  buildEnduroStartItem,
  buildRaceDaySlicesWithTheRaceClockSchema,
  buildTeam42ShortcutItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

const lowerThirdInstanceId = 'a7e3c915-2d4b-4f68-9b1e-6c0d8f2a4e57';
const clockInstanceId = '1c9e5a73-8b2d-4f06-a4e8-3d7b9f1c5e20';

/** The moment the operator typed a new clock time on air, 14:20:00 UTC, in milliseconds. */
const momentOfTheClockChangeOnAir = Date.parse('2026-10-09T14:20:00.000Z');

/** Builds "Tarja — Baja UFPR" on air after the operator retyped the team's name and cleared its number. */
function buildTeam42LowerThirdChangedOnAir(): Instance {
  return {
    id: lowerThirdInstanceId,
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { teamName: 'Baja UFPR Racing' },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:00:00.000Z',
    itemId: 'item-atalho-tarja-baja-ufpr',
    fieldsChangedOnAir: ['teamName', 'teamNumber'],
  };
}

/**
 * Builds "Largada do enduro" on air after the operator typed 0:30:00 at 14:20:00 and had
 * the server stamp the moment: both clock fields are listed.
 */
function buildEnduroStartClockRetimedOnAir(): Instance {
  return {
    id: clockInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: {
      ...buildEnduroClockData('green'),
      referenceTimeMs: 1_800_000,
      referenceWallClockMs: momentOfTheClockChangeOnAir,
    },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T13:00:00.000Z',
    itemId: 'item-largada-do-enduro',
    fieldsChangedOnAir: ['referenceTimeMs', 'referenceWallClockMs'],
  };
}

/** Builds the command "Salvar no item" sends, with the clock choice of the dialog. */
function buildSaveIntoItem(
  instanceId: string,
  wallClockFields: SaveOnAirChangesIntoItemCommand['wallClockFields'],
): SaveOnAirChangesIntoItemCommand {
  return { type: 'saveOnAirChangesIntoItem', instanceId, wallClockFields };
}

describe('saveOnAirChangesIntoItem writes what is on air into the item', () => {
  it('stores the listed fields as typed values, a cleared one as null, and empties the list', () => {
    // Arrange: the team 42 lower third, name retyped and number cleared on air.
    const slices = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildTeam42ShortcutItem(0)],
      instances: [buildTeam42LowerThirdChangedOnAir()],
    });

    // Act: the operator presses "Salvar no item" on the lower third's Camadas row.
    const outcome = reduceCommand(
      slices,
      buildSaveIntoItem(lowerThirdInstanceId, 'keepMoment'),
      contextOfTheRundownCommand,
    );

    // Assert: the item stores the air's values; the instance keeps its data, without a list.
    expect(outcome.status, 'saving the changes on air must be accepted').toBe('applied');
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : slices;
    const expectedItem: Item = {
      ...buildTeam42ShortcutItem(0),
      fields: {
        teamNumber: { kind: 'literal', value: null },
        teamName: { kind: 'literal', value: 'Baja UFPR Racing' },
      },
    };
    expect(slicesAfter.items, 'the item must now give what is on air').toEqual([expectedItem]);
    const instanceAfter: Instance = buildTeam42LowerThirdChangedOnAir();
    delete instanceAfter.fieldsChangedOnAir;
    expect(slicesAfter.instances, 'the air must be untouched and no longer marked').toEqual([
      instanceAfter,
    ]);
  });

  const clockChoiceScenarios = [
    // "Continuar este relógio": every take shows this very race time, running on.
    {
      name: 'stores the moment on air as a typed number for keepMoment',
      wallClockFields: 'keepMoment' as const,
      expectedMomentField: { kind: 'literal', value: momentOfTheClockChangeOnAir },
    },
    // "Começar na entrada no ar": every take starts the clock at 0:30:00 when it airs.
    {
      name: 'stores the moment as the moment of each take for atTake',
      wallClockFields: 'atTake' as const,
      expectedMomentField: { kind: 'takeTime' },
    },
  ];

  it.each(clockChoiceScenarios)('$name', ({ wallClockFields, expectedMomentField }) => {
    // Arrange: the enduro clock retimed on air, both its time and its moment listed.
    const slices = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildEnduroStartItem(0)],
      instances: [buildEnduroStartClockRetimedOnAir()],
    });

    // Act: "Salvar no item", with the choice this row makes in the clock dialog.
    const outcome = reduceCommand(
      slices,
      buildSaveIntoItem(clockInstanceId, wallClockFields),
      contextOfTheRundownCommand,
    );

    // Assert: the time is typed in either way; the moment follows the choice.
    expect(outcome.status, 'saving the clock into its item must be accepted').toBe('applied');
    const itemAfter = outcome.status === 'applied' ? outcome.slices.items[0] : undefined;
    expect(itemAfter?.fields.referenceTimeMs, 'the time on air must be typed in').toEqual({
      kind: 'literal',
      value: 1_800_000,
    });
    expect(
      itemAfter?.fields.referenceWallClockMs,
      'the moment must be stored as the dialog chose',
    ).toEqual(expectedMomentField);
    expect(
      itemAfter?.fields.sessionName,
      'a field not changed on air must keep its stored value',
    ).toEqual(buildEnduroStartItem(0).fields.sessionName);
  });
});

/** Builds the same lower third as if "Edição rápida" had put it on air before BAJAOVRLAY-37. */
function buildTeam42LowerThirdTakenByHandBeforeItemsWereRequired(): Instance {
  const instance = buildTeam42LowerThirdChangedOnAir();
  delete instance.itemId;
  return instance;
}

/** Builds the lower third of the item with nothing changed on air (no list). */
function buildTeam42LowerThirdWithNothingChangedOnAir(): Instance {
  const instance = buildTeam42LowerThirdChangedOnAir();
  delete instance.fieldsChangedOnAir;
  return instance;
}

describe('saveOnAirChangesIntoItem and a live preview of the same item', () => {
  it('takes the saved fields off the list of that preview too', () => {
    // Arrange: team 42's lower third changed on air (name and number), and a preview of
    // the same item with its name changed too.
    const previewOfTheSameItem: Instance = {
      ...buildTeam42LowerThirdChangedOnAir(),
      id: 'f3d1b8a6-4c2e-4e9f-a7b5-0d6c2e8f1a39',
      target: 'preview',
      status: 'loading',
      previewOrigin: 'manual',
      fieldsChangedOnAir: ['teamName'],
    };
    const slices = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildTeam42ShortcutItem(0)],
      instances: [buildTeam42LowerThirdChangedOnAir(), previewOfTheSameItem],
    });

    // Act: "Salvar no item" on the program row.
    const outcome = reduceCommand(
      slices,
      buildSaveIntoItem(lowerThirdInstanceId, 'keepMoment'),
      contextOfTheRundownCommand,
    );

    // Assert: the item now gives the name, so the preview no longer differs on it.
    const previewAfter =
      outcome.status === 'applied'
        ? outcome.slices.instances.find((instance) => instance.id === previewOfTheSameItem.id)
        : undefined;
    expect(previewAfter, 'the preview must still be there').toBeDefined();
    expect(
      previewAfter?.fieldsChangedOnAir,
      'a field saved into the item must leave the list of its live preview too',
    ).toBeUndefined();
  });
});

describe('saveOnAirChangesIntoItem refused', () => {
  const refusalScenarios = [
    // Another operator cleared the layer before the press reached the server.
    {
      name: 'refuses an instance that is no longer on any layer',
      items: [buildTeam42ShortcutItem(0)],
      instances: [],
      expectedCode: 'INSTANCE_NOT_FOUND',
    },
    // Taken by hand before BAJAOVRLAY-37: Camadas offers "Salvar como item" instead.
    {
      name: 'refuses an instance put on air by hand before items were required',
      items: [buildTeam42ShortcutItem(0)],
      instances: [buildTeam42LowerThirdTakenByHandBeforeItemsWereRequired()],
      expectedCode: 'INSTANCE_WITHOUT_ITEM',
    },
    // The item was deleted while its instance stayed on air ("item excluído").
    {
      name: 'refuses an instance whose item was deleted',
      items: [],
      instances: [buildTeam42LowerThirdChangedOnAir()],
      expectedCode: 'ITEM_NOT_FOUND',
    },
    // A second press, or another operator's, after the list was emptied.
    {
      name: 'refuses an instance with nothing changed on air',
      items: [buildTeam42ShortcutItem(0)],
      instances: [buildTeam42LowerThirdWithNothingChangedOnAir()],
      expectedCode: 'NOTHING_CHANGED_ON_AIR',
    },
  ];

  it.each(refusalScenarios)('$name', ({ items, instances, expectedCode }) => {
    // Arrange: a race day with this row's item and instance (or the lack of them).
    const slices = buildRaceDaySlicesWithTheRaceClockSchema({ items, instances });

    // Act: "Salvar no item" for the lower third.
    const outcome = reduceCommand(
      slices,
      buildSaveIntoItem(lowerThirdInstanceId, 'keepMoment'),
      contextOfTheRundownCommand,
    );

    // Assert: refused with the code this row expects, and a message for the operator.
    expect(outcome.status, 'the save must be refused').toBe('refused');
    const error = outcome.status === 'refused' ? outcome.error : undefined;
    expect(error?.code, 'the refusal must carry the code of its reason').toBe(expectedCode);
    expect(error?.message, 'the refusal must explain itself in pt-BR').toMatch(/\S/);
  });

  it('names the layer, in pt-BR, when the instance has no item to save into', () => {
    // Arrange: the lower third taken by hand before items were required.
    const slices = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildTeam42ShortcutItem(0)],
      instances: [buildTeam42LowerThirdTakenByHandBeforeItemsWereRequired()],
    });

    // Act: "Salvar no item" reaches the server from a page that offered it by mistake.
    const outcome = reduceCommand(
      slices,
      buildSaveIntoItem(lowerThirdInstanceId, 'keepMoment'),
      contextOfTheRundownCommand,
    );

    // Assert: the message names the layer as the operator reads it, and the way out.
    expect(outcome, 'the refusal must tell the operator what to do instead').toEqual({
      status: 'refused',
      error: {
        code: 'INSTANCE_WITHOUT_ITEM',
        message: 'O que está na camada Tarja não veio de um item. Use "Salvar como item".',
      },
    });
  });
});
