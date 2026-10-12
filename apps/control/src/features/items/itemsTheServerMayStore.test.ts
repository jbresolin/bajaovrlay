/**
 * The items the server may store for the item being edited (apps/control)
 *
 * What this module is for:
 *   The item editor sends only what differs from the stored item, so it must know what
 *   the server stores. After an accepted save it knows. After a save the server never
 *   answered (the 5-second timeout) it cannot know: the save may have been applied or
 *   lost. So the editor keeps every item the server may store, and sends each part in
 *   which the form differs from any of them. That way a value put back after an
 *   unanswered save is saved again, instead of the server keeping the value the operator
 *   gave up on.
 *
 * What these tests prove:
 *   - An accepted save leaves one certain item: the stored one with the save applied.
 *   - A refused save changes nothing.
 *   - An unanswered save keeps the item as it was and adds the item with the save applied.
 *   - An accepted save after an unanswered one leaves one certain item again.
 *   - The saves built against each item are joined into one save carrying every part
 *     any of them carried, and into no save at all when none carried anything.
 *
 * What these tests deliberately do not cover:
 *   - How one save is applied to an item: storedItemAfterAcceptedSave.test.ts.
 *   - Which parts a save against one item carries: itemCommandsFromEditor.test.ts.
 *   - The panel using both at a press: ItemEditorPanelUnansweredSave.test.tsx.
 */
import type { UpdateItemFieldsCommand } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildEnduranceStartClockItem } from './itemsLikeTheEditorSaves.testSupport';
import {
  type AnswerToSave,
  type ItemsTheServerMayStore,
  joinSavesOfOneFormIntoOne,
  listEveryItemTheServerMayStore,
  recordAnswerToSave,
} from './itemsTheServerMayStore';

const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

const saveOfTheGreenFlag: UpdateItemFieldsCommand = {
  type: 'updateItemFields',
  itemId: idOfTheEnduranceStartItem,
  fields: { state: { kind: 'literal', value: 'green' } },
};

/** Builds the endurance start item as the server stores it once the green flag is saved. */
function buildEnduranceStartClockItemWithGreenFlag() {
  const itemAsStored = buildEnduranceStartClockItem();
  return {
    ...itemAsStored,
    fields: { ...itemAsStored.fields, state: { kind: 'literal' as const, value: 'green' } },
  };
}

/** Builds what the editor knows right after opening the endurance start item. */
function buildItemsKnownWhenTheEditorOpened(): ItemsTheServerMayStore {
  return {
    itemAfterTheAnsweredSaves: buildEnduranceStartClockItem(),
    itemsIfAnUnansweredSaveWasApplied: [],
  };
}

const answerScenarios: Array<{
  name: string;
  answerToSave: AnswerToSave;
  expectedItems: ItemsTheServerMayStore;
}> = [
  // The usual case: the server said ok, so the editor knows the flag is stored as green.
  {
    name: 'keeps one certain item, with the save applied, when the save was accepted',
    answerToSave: 'accepted',
    expectedItems: {
      itemAfterTheAnsweredSaves: buildEnduranceStartClockItemWithGreenFlag(),
      itemsIfAnUnansweredSaveWasApplied: [],
    },
  },
  // The server said no: it stores what it stored before.
  {
    name: 'changes nothing when the save was refused',
    answerToSave: 'refused',
    expectedItems: buildItemsKnownWhenTheEditorOpened(),
  },
  // No answer in 5 seconds: the flag may be stored as "pre" or as green, so both stay.
  {
    name: 'keeps the item as it was and adds the item with the save applied when the save was left unanswered',
    answerToSave: 'leftUnanswered',
    expectedItems: {
      itemAfterTheAnsweredSaves: buildEnduranceStartClockItem(),
      itemsIfAnUnansweredSaveWasApplied: [buildEnduranceStartClockItemWithGreenFlag()],
    },
  },
];

describe('recordAnswerToSave', () => {
  it.each(answerScenarios)('$name', ({ answerToSave, expectedItems }) => {
    // Arrange: the editor just opened the endurance start item (pre-start flag).
    const itemsBeforeTheSave = buildItemsKnownWhenTheEditorOpened();

    // Act: the save of the green flag gets the answer of this row.
    const itemsAfterTheSave = recordAnswerToSave(
      itemsBeforeTheSave,
      saveOfTheGreenFlag,
      answerToSave,
    );

    // Assert: the editor knows exactly the items the server may store now.
    expect(
      itemsAfterTheSave,
      'the items the server may store must follow from the answer to the save',
    ).toEqual(expectedItems);
  });

  it('keeps one certain item again once a later save is accepted', () => {
    // Arrange: the save of the green flag was left unanswered, so two items are possible.
    const itemsAfterTheUnansweredSave = recordAnswerToSave(
      buildItemsKnownWhenTheEditorOpened(),
      saveOfTheGreenFlag,
      'leftUnanswered',
    );

    // Act: the operator presses again, the same save is sent and this time accepted.
    const itemsAfterTheAcceptedSave = recordAnswerToSave(
      itemsAfterTheUnansweredSave,
      saveOfTheGreenFlag,
      'accepted',
    );

    // Assert: the doubt is over. Whichever item the server stored, it now has the green flag.
    expect(
      itemsAfterTheAcceptedSave,
      'an accepted save must leave one certain item and no other possibility',
    ).toEqual({
      itemAfterTheAnsweredSaves: buildEnduranceStartClockItemWithGreenFlag(),
      itemsIfAnUnansweredSaveWasApplied: [],
    });
  });
});

describe('listEveryItemTheServerMayStore', () => {
  it('lists the certain item first and then each item an unanswered save may have left', () => {
    // Arrange: the save of the green flag was left unanswered.
    const itemsAfterTheUnansweredSave = recordAnswerToSave(
      buildItemsKnownWhenTheEditorOpened(),
      saveOfTheGreenFlag,
      'leftUnanswered',
    );

    // Act: ask for every item the next save must be compared with.
    const everyItem = listEveryItemTheServerMayStore(itemsAfterTheUnansweredSave);

    // Assert: the item with the pre-start flag, then the one with the green flag.
    expect(everyItem, 'both the item as it was and the item with the save applied').toEqual([
      buildEnduranceStartClockItem(),
      buildEnduranceStartClockItemWithGreenFlag(),
    ]);
  });
});

const joinScenarios: Array<{
  name: string;
  savesAgainstEachItem: Array<UpdateItemFieldsCommand | undefined>;
  expectedSave: UpdateItemFieldsCommand | undefined;
}> = [
  // The form equals every item the server may store: there is nothing to send.
  {
    name: 'answers no save when no item needed one',
    savesAgainstEachItem: [undefined, undefined],
    expectedSave: undefined,
  },
  // The story of the bug: the flag was put back to "pre". Against the item as opened
  // nothing differs; against the item with the unanswered green flag, the flag does.
  {
    name: 'answers the one save an item needed when the other needed none',
    savesAgainstEachItem: [
      undefined,
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { state: { kind: 'literal', value: 'pre' } },
      },
    ],
    expectedSave: {
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      fields: { state: { kind: 'literal', value: 'pre' } },
    },
  },
  // Each item differs from the form in other parts: one save must carry them all.
  {
    name: 'carries every part and every field any of the saves carried',
    savesAgainstEachItem: [
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Relargada do Enduro',
        fields: { state: { kind: 'literal', value: 'yellow' } },
      },
      {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        autoOutAfterMs: null,
        fields: { lapsCompletedByLeader: { kind: 'literal', value: 7 } },
      },
    ],
    expectedSave: {
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      label: 'Relargada do Enduro',
      autoOutAfterMs: null,
      fields: {
        state: { kind: 'literal', value: 'yellow' },
        lapsCompletedByLeader: { kind: 'literal', value: 7 },
      },
    },
  },
  // A save of the label alone must not gain an empty list of fields on the way.
  {
    name: 'leaves the fields out when no save carried any',
    savesAgainstEachItem: [
      { type: 'updateItemFields', itemId: idOfTheEnduranceStartItem, label: 'Relargada do Enduro' },
      { type: 'updateItemFields', itemId: idOfTheEnduranceStartItem, color: 'warning' },
    ],
    expectedSave: {
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      label: 'Relargada do Enduro',
      color: 'warning',
    },
  },
];

describe('joinSavesOfOneFormIntoOne', () => {
  it.each(joinScenarios)('$name', ({ savesAgainstEachItem, expectedSave }) => {
    // Arrange: the saves of this row, one per item the server may store.

    // Act: join them into the one save the editor sends.
    const joinedSave = joinSavesOfOneFormIntoOne(savesAgainstEachItem);

    // Assert: one save with every part any of them carried, or none at all.
    expect(joinedSave, 'the joined save must carry exactly the parts the saves carried').toEqual(
      expectedSave,
    );
  });
});
