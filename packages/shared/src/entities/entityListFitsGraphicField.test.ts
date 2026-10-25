/**
 * Which graphic fields an entity list fits (packages/shared)
 *
 * What this module is for:
 *   The item editor offers "Lista dos cadastros" (BAJAOVRLAY-46) only on a field that can
 *   take the list: an array of objects whose `items.required` names keys every item of the
 *   list always carries, by the same rule a source's whole list follows (listItemKeys.ts).
 *   Otherwise the take would fail on the manifest's schema after the operator chose it.
 *   The server runs the same check when the item is saved.
 *
 * What these tests prove:
 *   - The sponsor roll's sponsors field takes every sponsor and not the schedule; the
 *     sessions board's slots field takes the schedule and not the sponsors.
 *   - A field that asks of each slot something not every slot has (its end) takes no list.
 *   - A list of texts (the message ticker's messages), a text field and an undeclared
 *     field take none.
 *   - Saving a list on a field it does not fit is refused in pt-BR, naming the list.
 *   - The keys listed as carried by every item are really in every item the resolution
 *     gives, so the hand-written lists cannot drift from it.
 *
 * What these tests deliberately do not cover:
 *   - The editor's selector; the control page's SchemaFormFieldsEntityList.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { buildLibraryOfTheRaceWeekend } from './entityLibrary.testSupport.js';
import {
  findProblemInEntityListForDataSchemaField,
  listEntityListTypesThatFitDataSchemaField,
} from './entityListFitsGraphicField.js';
import { listKeysEveryItemOfEntityListCarries } from './entityListItems.js';
import { resolveEntityListAgainstLibrary } from './entityListResolution.js';

/** A data schema with the four kinds of field these tests need, as manifests write them. */
const dataSchemaOfTheTests = {
  type: 'object',
  properties: {
    // The sponsor roll's list.
    sponsors: {
      type: 'array',
      items: { type: 'object', required: ['name', 'level', 'logoUrl'] },
    },
    // The sessions board's list.
    slots: {
      type: 'array',
      items: { type: 'object', required: ['slotId', 'sessionName', 'startsAtMs'] },
    },
    // A board that would need every slot's end: the briefing has none.
    slotsWithTheirEnd: {
      type: 'array',
      items: { type: 'object', required: ['sessionName', 'endsAtMs'] },
    },
    // The message ticker's messages: a list of texts.
    messages: { type: 'array', items: { type: 'string' } },
    // A plain text.
    title: { type: 'string' },
  },
};

describe('listEntityListTypesThatFitDataSchemaField', () => {
  const fieldScenarios = [
    // The sponsor roll's field asks for keys every sponsor carries.
    { name: 'offers the sponsors to the roll’s list', fieldKey: 'sponsors', expected: ['sponsor'] },
    // The sessions board's field asks for keys every slot carries.
    {
      name: 'offers the schedule to the board’s list',
      fieldKey: 'slots',
      expected: ['scheduleSlot'],
    },
    // Not every slot has an end, so the take could fail: nothing is offered.
    {
      name: 'offers nothing to a list that asks for every slot’s end',
      fieldKey: 'slotsWithTheirEnd',
      expected: [],
    },
    // A list of texts is typed line by line; an object per line would not fit it.
    { name: 'offers nothing to a list of texts', fieldKey: 'messages', expected: [] },
    // Not an array at all.
    { name: 'offers nothing to a text field', fieldKey: 'title', expected: [] },
    // A key the schema does not declare.
    { name: 'offers nothing to a field the schema lacks', fieldKey: 'logos', expected: [] },
  ];

  it.each(fieldScenarios)('$name', ({ fieldKey, expected }) => {
    // Arrange: the schema above and the field of this row.

    // Act: list what fits the field.
    const listTypes = listEntityListTypesThatFitDataSchemaField(dataSchemaOfTheTests, fieldKey);

    // Assert: exactly the expected lists.
    expect(listTypes, `the lists offered to "${fieldKey}"`).toEqual(expected);
  });
});

describe('findProblemInEntityListForDataSchemaField', () => {
  it('accepts every sponsor on the roll’s list', () => {
    // Arrange: every sponsor, on the field that takes it.
    const list = { kind: 'entityList' as const, entityType: 'sponsor' as const };

    // Act: check it.
    const problem = findProblemInEntityListForDataSchemaField(
      list,
      dataSchemaOfTheTests,
      'sponsors',
    );

    // Assert: no problem.
    expect(problem, 'a fitting list must be accepted').toBeUndefined();
  });

  it('refuses the schedule on the roll’s list, naming the list in pt-BR', () => {
    // Arrange: every slot, on the sponsors' field.
    const list = { kind: 'entityList' as const, entityType: 'scheduleSlot' as const };

    // Act: check it.
    const problem = findProblemInEntityListForDataSchemaField(
      list,
      dataSchemaOfTheTests,
      'sponsors',
    );

    // Assert: the sentence the server puts the field's title before.
    expect(problem, 'the refusal must name the list').toBe(
      'a lista de sessões da programação dos cadastros não serve para este campo.',
    );
  });
});

describe('the keys every item carries', () => {
  const listTypes = [
    // Every sponsor of the race weekend's library has its logo.
    { name: 'are in every sponsor the resolution gives', listType: 'sponsor' as const },
    // Every slot of the race weekend's schedule.
    { name: 'are in every slot the resolution gives', listType: 'scheduleSlot' as const },
  ];

  it.each(listTypes)('$name', ({ listType }) => {
    // Arrange: the library of the race weekend.
    const library = buildLibraryOfTheRaceWeekend();

    // Act: read the list and the keys said to be carried.
    const resolution = resolveEntityListAgainstLibrary(
      { kind: 'entityList', entityType: listType },
      library,
    );
    const keysCarried = listKeysEveryItemOfEntityListCarries(listType);

    // Assert: a list came back, and each of its items has every one of those keys.
    const items = resolution.status === 'resolved' ? resolution.value : [];
    expect(items.length, 'the race weekend has records of this kind').toBeGreaterThan(0);
    for (const item of items) {
      expect(Object.keys(item), 'each item carries every key listed').toEqual(
        expect.arrayContaining(keysCarried),
      );
    }
  });
});
