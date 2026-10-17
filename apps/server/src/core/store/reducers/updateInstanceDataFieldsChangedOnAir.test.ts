/**
 * updateInstanceData and the list of fields changed on air (apps/server)
 *
 * What this module is for:
 *   Everything on air comes from an item. When the operator changes an instance of an
 *   item in place ("Atualizar" in "Edição rápida"), the instance no longer shows what the
 *   item gives, and the operator must be able to see that ("alterado no ar" in Camadas)
 *   and to keep it ("Salvar no item"). So the reducer writes into the instance, in
 *   `fieldsChangedOnAir`, the top-level fields the operator sent that now differ from
 *   what the item gives, added to those listed by earlier updates.
 *
 * What these tests prove, one row each:
 *   - A field sent with a new value is listed; a second update adds its own fields.
 *   - A field stays listed after it is updated back to the item's value. Deliberately
 *     simple: the list only grows until the item is taken again or the changes are
 *     saved into it.
 *   - A field sent with the very value the item now gives is not listed, which is what
 *     the item editor's "Atualizar no ar" sends right after saving the item.
 *   - A field cleared on air is listed when the item gives it a value.
 *   - The clock fields the update rule rewrote (carryClockForward) are listed only when
 *     the operator sent them, and so is a field the item marks takeTime.
 *   - An instance put on air by hand before BAJAOVRLAY-37 (no item) gets no list, and one
 *     whose item was deleted since lists every field sent.
 *   - An update that changes nothing writes no list.
 *
 * What these tests deliberately do not cover:
 *   - The rest of updateInstanceData (nulls, stamps, the data check, the update rule
 *     itself); updateInstanceData.test.ts and its siblings do.
 *   - Previews ("Atualizar prévia") and taking the item again;
 *     updatePreviewInstanceData.test.ts does.
 *   - Saving the list into the item; saveOnAirChangesIntoItem.test.ts does.
 */
import type { Instance, Item, UpdateInstanceDataCommand } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroClockData,
  buildEnduroStartItem,
  buildRaceDaySlicesWithTheRaceClockSchema,
  buildTeam42ShortcutItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';
import { reduceUpdateInstanceData } from './updateInstanceData.js';

const lowerThirdInstanceId = 'a7e3c915-2d4b-4f68-9b1e-6c0d8f2a4e57';
const clockInstanceId = '1c9e5a73-8b2d-4f06-a4e8-3d7b9f1c5e20';

/** Builds "Tarja — Baja UFPR" on air on program, exactly as its take left it. */
function buildTeam42LowerThirdOfItemOnProgram(): Instance {
  return {
    id: lowerThirdInstanceId,
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:00:00.000Z',
    itemId: 'item-atalho-tarja-baja-ufpr',
  };
}

/** Builds the same lower third as "Edição rápida" put it on air before BAJAOVRLAY-37: no item. */
function buildTeam42LowerThirdTakenByHandBeforeItemsWereRequired(): Instance {
  const instance = buildTeam42LowerThirdOfItemOnProgram();
  delete instance.itemId;
  return instance;
}

/** Builds "Largada do enduro" on air on program, its clock running since 13:00 UTC. */
function buildEnduroStartClockOfItemOnProgram(): Instance {
  return {
    id: clockInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: buildEnduroClockData('green'),
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T13:00:00.000Z',
    itemId: 'item-largada-do-enduro',
  };
}

/** Builds "Tarja — Baja UFPR" after "Salvar" stored the team's new name in the item. */
function buildTeam42ShortcutItemWithTheNewName(): Item {
  const item = buildTeam42ShortcutItem(0);
  item.fields = { ...item.fields, teamName: { kind: 'literal', value: 'Baja UFPR Racing' } };
  return item;
}

/** Builds "Largada do enduro" with its reference moment left to the server at each take. */
function buildEnduroStartItemStampedAtTake(): Item {
  const item = buildEnduroStartItem(0);
  item.fields = { ...item.fields, referenceWallClockMs: { kind: 'takeTime' } };
  return item;
}

/** Builds an updateInstanceData as "Atualizar" sends it: the changed fields, maybe a stamp. */
function buildUpdate(
  instanceId: string,
  data: Record<string, unknown>,
  takeTimeFieldKeys: string[] = [],
): UpdateInstanceDataCommand {
  return { type: 'updateInstanceData', instanceId, data, takeTimeFieldKeys };
}

/**
 * Runs the updates one after the other, each on the slices the one before left, as the
 * store does, and hands back the instance at the end. Fails the test on a refusal.
 */
function applyUpdatesOneAfterTheOther(
  slices: SlicesChangedByCommands,
  updates: UpdateInstanceDataCommand[],
  instanceId: string,
): Instance | undefined {
  let slicesSoFar = slices;
  for (const update of updates) {
    const outcome = reduceUpdateInstanceData(slicesSoFar, update, contextOfTheRundownCommand);
    if (outcome.status === 'refused') {
      throw new Error(`the update was refused: ${outcome.error.message}`);
    }
    slicesSoFar = outcome.slices;
  }
  return slicesSoFar.instances.find((instance) => instance.id === instanceId);
}

describe('updateInstanceData and fieldsChangedOnAir', () => {
  const changedFieldScenarios = [
    // The common case: the operator retypes the team's name on air.
    {
      name: 'lists the field the operator changed on an instance of an item',
      items: [buildTeam42ShortcutItem(0)],
      instance: buildTeam42LowerThirdOfItemOnProgram(),
      updates: [buildUpdate(lowerThirdInstanceId, { teamName: 'Baja UFPR Racing' })],
      expectedList: ['teamName'],
    },
    // The list is a union: a second "Atualizar" adds its fields to the first one's.
    {
      name: 'adds the fields of a second update to those of the first',
      items: [buildTeam42ShortcutItem(0)],
      instance: buildTeam42LowerThirdOfItemOnProgram(),
      updates: [
        buildUpdate(lowerThirdInstanceId, { teamName: 'Baja UFPR Racing' }),
        buildUpdate(lowerThirdInstanceId, { teamNumber: 24 }),
      ],
      expectedList: ['teamName', 'teamNumber'],
    },
    // Kept simple on purpose: putting the item's value back does not take the field off.
    {
      name: "keeps a field listed after it is updated back to the item's value",
      items: [buildTeam42ShortcutItem(0)],
      instance: buildTeam42LowerThirdOfItemOnProgram(),
      updates: [
        buildUpdate(lowerThirdInstanceId, { teamName: 'Baja UFPR Racing' }),
        buildUpdate(lowerThirdInstanceId, { teamName: 'Baja UFPR' }),
      ],
      expectedList: ['teamName'],
    },
    // "Atualizar no ar" of the item editor saves the item first, then sends the same
    // value to the air: the air then shows what the item gives, so nothing is listed.
    {
      name: 'does not list a field sent with the very value the item now gives',
      items: [buildTeam42ShortcutItemWithTheNewName()],
      instance: buildTeam42LowerThirdOfItemOnProgram(),
      updates: [buildUpdate(lowerThirdInstanceId, { teamName: 'Baja UFPR Racing' })],
      expectedList: undefined,
    },
    // A field taken off the air differs from an item that gives it a value.
    {
      name: 'lists a field cleared on air that the item gives a value for',
      items: [buildTeam42ShortcutItem(0)],
      instance: buildTeam42LowerThirdOfItemOnProgram(),
      updates: [buildUpdate(lowerThirdInstanceId, { teamName: null })],
      expectedList: ['teamName'],
    },
    // Stopping the clock: carryClockForward rewrites the time and the moment, which the
    // operator did not send, so only the running switch is the operator's change.
    {
      name: 'lists only the running switch when the operator stops the clock',
      items: [buildEnduroStartItem(0)],
      instance: buildEnduroStartClockOfItemOnProgram(),
      updates: [buildUpdate(clockInstanceId, { running: false })],
      expectedList: ['running'],
    },
    // A typed time is the operator's; the moment the rule writes beside it is not.
    {
      name: 'lists a typed time but not the moment the update rule wrote beside it',
      items: [buildEnduroStartItem(0)],
      instance: buildEnduroStartClockOfItemOnProgram(),
      updates: [buildUpdate(clockInstanceId, { referenceTimeMs: 0 })],
      expectedList: ['referenceTimeMs'],
    },
    // The item marks the moment takeTime; the operator changed something else only.
    {
      name: 'does not list a field the item marks takeTime when the operator did not send it',
      items: [buildEnduroStartItemStampedAtTake()],
      instance: buildEnduroStartClockOfItemOnProgram(),
      updates: [buildUpdate(clockInstanceId, { sessionName: 'Enduro — 2ª hora' })],
      expectedList: ['sessionName'],
    },
    // "Momento da entrada no ar" chosen again on air: the operator asked for a new stamp.
    {
      name: 'lists a field the item marks takeTime when the operator had it stamped',
      items: [buildEnduroStartItemStampedAtTake()],
      instance: buildEnduroStartClockOfItemOnProgram(),
      updates: [buildUpdate(clockInstanceId, {}, ['referenceWallClockMs'])],
      expectedList: ['referenceWallClockMs'],
    },
    // Taken by hand before BAJAOVRLAY-37: there is no item to differ from.
    {
      name: 'writes no list on an instance put on air by hand before items were required',
      items: [buildTeam42ShortcutItem(0)],
      instance: buildTeam42LowerThirdTakenByHandBeforeItemsWereRequired(),
      updates: [buildUpdate(lowerThirdInstanceId, { teamName: 'Baja UFPR Racing' })],
      expectedList: undefined,
    },
    // The item was deleted since the take: every field sent counts as changed.
    {
      name: 'lists every field sent when the item was deleted since the take',
      items: [],
      instance: buildTeam42LowerThirdOfItemOnProgram(),
      updates: [buildUpdate(lowerThirdInstanceId, { teamName: 'Baja UFPR', teamNumber: 24 })],
      expectedList: ['teamName', 'teamNumber'],
    },
  ];

  it.each(changedFieldScenarios)('$name', ({ items, instance, updates, expectedList }) => {
    // Arrange: a race day with the item of this row and its instance on air.
    const slices = buildRaceDaySlicesWithTheRaceClockSchema({ items, instances: [instance] });

    // Act: send this row's updates, one after the other.
    const instanceAfter = applyUpdatesOneAfterTheOther(slices, updates, instance.id);

    // Assert: the instance lists exactly the fields this row expects, or none at all.
    expect(instanceAfter, 'the instance must still be on air after the updates').toBeDefined();
    expect(
      instanceAfter?.fieldsChangedOnAir,
      'the list must name the fields the operator changed away from the item',
    ).toEqual(expectedList);
  });

  it('writes no list when the update changes nothing on air', () => {
    // Arrange: the lower third of the item, untouched.
    const slices = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildTeam42ShortcutItem(0)],
      instances: [buildTeam42LowerThirdOfItemOnProgram()],
    });

    // Act: "Atualizar" re-sends the name that is already on air.
    const outcome = reduceUpdateInstanceData(
      slices,
      buildUpdate(lowerThirdInstanceId, { teamName: 'Baja UFPR' }),
      contextOfTheRundownCommand,
    );

    // Assert: the very same slices come back, so nothing is saved and no chip appears.
    expect(outcome.status, 'an update that changes nothing is still accepted').toBe('applied');
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'an update that changes nothing must hand back the same slices',
    ).toBe(slices);
  });
});
