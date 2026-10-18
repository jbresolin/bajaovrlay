/**
 * updateItemFields and the "alterado no ar" of the item's live instances (apps/server)
 *
 * What this module is for:
 *   An instance lists in `fieldsChangedOnAir` the fields the operator changed on air.
 *   When the item itself is then saved with a new value for one of those fields (the item
 *   editor's "Salvar"), that field's change on air is no longer the newest word about it:
 *   the item is. Left on the list, a later "Salvar no item" would write the older value
 *   from the air over the newer one in the item, silently (gate 2 of PR #15). So
 *   updateItemFields takes every field whose stored value it changed off the list of each
 *   live instance of that item, on program and in preview.
 *
 * What these tests prove:
 *   - A field saved into the item leaves the list of the program instance and of the
 *     preview of that item; a field not saved stays listed, and a list left empty goes.
 *   - An instance of another item is left alone.
 *   - A save that changes no field (the label only) leaves every list as it was.
 *
 * What these tests deliberately do not cover:
 *   - How fields join the list; updateInstanceDataFieldsChangedOnAir.test.ts.
 *   - The rest of updateItemFields; updateItemFields.test.ts and its siblings.
 */
import type { Instance, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildPodiumTeamItem,
  buildRaceDaySlicesWithRundown,
  buildTeam42ShortcutItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

const programInstanceId = 'a7e3c915-2d4b-4f68-9b1e-6c0d8f2a4e57';
const previewInstanceId = 'f3d1b8a6-4c2e-4e9f-a7b5-0d6c2e8f1a39';
const podiumInstanceId = 'b8e2f4a1-6c3d-4e95-8a07-1d9c5e3b7f26';

/** Builds an instance of this item changed on air, on this output, listing these fields. */
function buildInstanceChangedOnAir(
  id: string,
  item: Item,
  target: 'program' | 'preview',
  fieldsChangedOnAir: string[],
): Instance {
  return {
    id,
    layerId: 'lower-third',
    graphicId: item.graphicId,
    target,
    resolvedData: { teamNumber: 24, teamName: 'Baja UFPR Racing' },
    currentStep: 0,
    status: target === 'program' ? 'on-air' : 'loading',
    takenAt: '2026-10-09T14:00:00.000Z',
    itemId: item.id,
    fieldsChangedOnAir,
  };
}

/** The lists of changed fields of every instance, by instance id. */
function readListsById(instances: Instance[]): Record<string, string[] | undefined> {
  return Object.fromEntries(
    instances.map((instance) => [instance.id, instance.fieldsChangedOnAir]),
  );
}

/**
 * Team 42's shortcut item on air with its name and number changed, its preview with the
 * name changed, and the podium item's lower third with its name changed (another item).
 */
function buildRaceDayWithChangedInstances() {
  const team42Item = buildTeam42ShortcutItem(0);
  const podiumItem = buildPodiumTeamItem(0);
  return buildRaceDaySlicesWithRundown({
    items: [team42Item, podiumItem],
    instances: [
      buildInstanceChangedOnAir(programInstanceId, team42Item, 'program', [
        'teamName',
        'teamNumber',
      ]),
      buildInstanceChangedOnAir(previewInstanceId, team42Item, 'preview', ['teamName']),
      {
        ...buildInstanceChangedOnAir(podiumInstanceId, podiumItem, 'program', ['teamName']),
        layerId: 'fullscreen',
      },
    ],
  });
}

describe('updateItemFields and fieldsChangedOnAir', () => {
  it('takes a field saved into the item off the lists of that item’s instances', () => {
    // Arrange: the instances above.
    const slices = buildRaceDayWithChangedInstances();

    // Act: the item editor saves a new team name into team 42's item.
    const outcome = reduceCommand(
      slices,
      {
        type: 'updateItemFields',
        itemId: 'item-atalho-tarja-baja-ufpr',
        fields: { teamName: { kind: 'literal', value: 'Equipe Baja UFPR' } },
      },
      contextOfTheRundownCommand,
    );

    // Assert: the name left both lists of team 42; the number stays; the podium is alone.
    expect(outcome.status, 'the save must be accepted').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : [];
    expect(
      readListsById(instancesAfter),
      'the item now has the newest word on the saved field, on program and in preview',
    ).toEqual({
      [programInstanceId]: ['teamNumber'],
      [previewInstanceId]: undefined,
      [podiumInstanceId]: ['teamName'],
    });
  });

  it('leaves every list as it was when the save changes no field', () => {
    // Arrange: the instances above.
    const slices = buildRaceDayWithChangedInstances();

    // Act: the item editor saves a new label only.
    const outcome = reduceCommand(
      slices,
      {
        type: 'updateItemFields',
        itemId: 'item-atalho-tarja-baja-ufpr',
        label: 'Tarja — Bateria 2',
      },
      contextOfTheRundownCommand,
    );

    // Assert: the instances are the very same array: nothing about the air changed.
    expect(
      outcome.status === 'applied' ? outcome.slices.instances : undefined,
      'a save of the label alone must leave the instances untouched',
    ).toBe(slices.instances);
  });
});
