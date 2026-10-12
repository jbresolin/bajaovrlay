/**
 * The stored item after a save the server accepted (apps/control)
 *
 * What this module is for:
 *   The item editor sends only what differs from the stored item. When a save was
 *   accepted and the editor stays open (the on-air update of "Atualizar no ar" was
 *   refused), the next press must be compared with what the server stores NOW, which is
 *   the item as it was plus that save. This function works that item out, so a value put
 *   back afterwards counts as a change and is saved.
 *
 * What these tests prove:
 *   - Each part the save carried (label, colour, notes, auto-out) replaces the item's.
 *   - An auto-out sent as null removes the item's auto-out.
 *   - The fields the save carried replace the same fields of the item, and every other
 *     field stays as it was.
 *   - A save that carried one part leaves every other part of the item untouched.
 *   - The item handed in is not modified.
 *
 * What these tests deliberately do not cover:
 *   - Which parts a save carries: itemCommandsFromEditor.test.ts.
 *   - How the server merges the same command (apps/server); this function must agree
 *     with it, and the panel tests show the two working together on a fake server.
 */
import type { Item, UpdateItemFieldsCommand } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduranceStartClockItem,
  buildInterviewLowerThirdItem,
} from './itemsLikeTheEditorSaves.testSupport';
import { buildStoredItemAfterAcceptedSave } from './storedItemAfterAcceptedSave';

const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';
const idOfTheInterviewItem = '5e1a9c73-2b64-4f08-b3d1-7a9e0c6d8f25';

type AcceptedSaveScenario = {
  name: string;
  storedItem: Item;
  acceptedSave: UpdateItemFieldsCommand;
  expectedItem: Item;
};

const acceptedSaveScenarios: AcceptedSaveScenario[] = [
  // The story of the bug: the flag saved as green must become the stored flag, so that
  // putting it back to "pre" later is seen as a change.
  {
    name: 'replaces the one field the save carried and keeps the other fields',
    storedItem: buildEnduranceStartClockItem(),
    acceptedSave: {
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      fields: { state: { kind: 'literal', value: 'green' } },
    },
    expectedItem: {
      ...buildEnduranceStartClockItem(),
      fields: {
        ...buildEnduranceStartClockItem().fields,
        state: { kind: 'literal', value: 'green' },
      },
    },
  },
  // A field the item did not store before (the laps) is added, as the server adds it.
  {
    name: 'adds a field the item did not store before',
    storedItem: buildEnduranceStartClockItem(),
    acceptedSave: {
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      fields: { lapsCompletedByLeader: { kind: 'literal', value: 7 } },
    },
    expectedItem: {
      ...buildEnduranceStartClockItem(),
      fields: {
        ...buildEnduranceStartClockItem().fields,
        lapsCompletedByLeader: { kind: 'literal', value: 7 },
      },
    },
  },
  // The parts every item has travel outside `fields`; each must be taken over.
  {
    name: 'replaces the label, the colour and the notes the save carried',
    storedItem: buildEnduranceStartClockItem(),
    acceptedSave: {
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      label: 'Relargada do Enduro',
      color: 'warning',
      notes: 'Entrar depois da bandeira vermelha.',
    },
    expectedItem: {
      ...buildEnduranceStartClockItem(),
      label: 'Relargada do Enduro',
      color: 'warning',
      notes: 'Entrar depois da bandeira vermelha.',
    },
  },
  // A number sets the auto-out of an item that had none.
  {
    name: 'sets the auto-out the save carried',
    storedItem: buildEnduranceStartClockItem(),
    acceptedSave: {
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      autoOutAfterMs: 12_000,
    },
    expectedItem: { ...buildEnduranceStartClockItem(), autoOutAfterMs: 12_000 },
  },
  // Null is how the command says "no auto-out any more": the item must end without the
  // key, exactly as an item that never had one, or the next press would see a difference.
  {
    name: 'removes the auto-out when the save carried null for it',
    storedItem: buildInterviewLowerThirdItem(),
    acceptedSave: {
      type: 'updateItemFields',
      itemId: idOfTheInterviewItem,
      autoOutAfterMs: null,
    },
    expectedItem: {
      id: idOfTheInterviewItem,
      rundownId: 'sessao-principal',
      order: 1,
      graphicId: 'lower-third-fixture',
      layerId: 'lower-third',
      fields: buildInterviewLowerThirdItem().fields,
      label: 'Tarja da equipe 42',
      color: 'info',
      notes: '',
    },
  },
  // A save of the label alone must not disturb the auto-out or the fields.
  {
    name: 'keeps every part the save did not carry',
    storedItem: buildInterviewLowerThirdItem(),
    acceptedSave: {
      type: 'updateItemFields',
      itemId: idOfTheInterviewItem,
      label: 'Tarja da capitã da equipe 42',
    },
    expectedItem: { ...buildInterviewLowerThirdItem(), label: 'Tarja da capitã da equipe 42' },
  },
];

describe('buildStoredItemAfterAcceptedSave', () => {
  it.each(acceptedSaveScenarios)('$name', ({ storedItem, acceptedSave, expectedItem }) => {
    // Arrange: the stored item and the save of this row (both come from the table).

    // Act: work out what the server stores once it accepted the save.
    const itemAfterTheSave = buildStoredItemAfterAcceptedSave(storedItem, acceptedSave);

    // Assert: the item is the stored one with the saved parts taken over.
    expect(
      itemAfterTheSave,
      'the item must be the stored one with exactly the saved parts replaced',
    ).toEqual(expectedItem);
  });

  it('leaves the item it was handed as it was', () => {
    // Arrange: the endurance start item, and a save of the green flag.
    const storedItem = buildEnduranceStartClockItem();

    // Act: work out the item after the save.
    buildStoredItemAfterAcceptedSave(storedItem, {
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      label: 'Relargada do Enduro',
      fields: { state: { kind: 'literal', value: 'green' } },
    });

    // Assert: the item handed in still holds the pre-start flag and its old label; the
    // editor keeps it to judge what goes on air.
    expect(storedItem, 'the item handed in must not be modified').toEqual(
      buildEnduranceStartClockItem(),
    );
  });
});
