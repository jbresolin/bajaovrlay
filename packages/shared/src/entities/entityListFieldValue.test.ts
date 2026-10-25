/**
 * The entity list: an item field that reads a whole list of the library (packages/shared)
 *
 * What this module is for:
 *   The sponsor roll needs every sponsor and the sessions board every slot of the
 *   schedule, not one record. The FieldValue kind `entityList` (BAJAOVRLAY-46) says "every
 *   record of this kind", for the two kinds a graphic shows as a whole: sponsors and
 *   schedule slots. It names nothing else; the server reads the list from Cadastros at
 *   the take, and an edit, add or delete of any record of that kind reaches the air.
 *
 * What these tests prove:
 *   - Every sponsor and every slot of the schedule are accepted, as entity lists and as
 *     FieldValues stored on an item and kept on an instance.
 *   - Teams and people are refused: no graphic shows them as a whole list from the library
 *     (the standings and the tower read a source).
 *   - The schema is strict: a record key or an attribute beside it is refused, not dropped.
 *
 * What these tests deliberately do not cover:
 *   - Reading the list; entityListResolution.test.ts.
 *   - Which graphic fields it fits; entityListFitsGraphicField.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { InstanceEntityFieldSchema } from '../bindings/instanceBindings.js';
import { FieldValueSchema } from '../rundown/fieldValue.js';
import { EntityListFieldValueSchema } from './entityListFieldValue.js';

describe('EntityListFieldValueSchema', () => {
  const acceptedLists = [
    // The sponsor roll's sponsors.
    { name: 'accepts every sponsor', list: { kind: 'entityList', entityType: 'sponsor' } },
    // The sessions board's slots.
    {
      name: 'accepts every slot of the schedule',
      list: { kind: 'entityList', entityType: 'scheduleSlot' },
    },
  ];

  it.each(acceptedLists)('$name', ({ list }) => {
    // Arrange: the list of this row.

    // Act: check it alone, as a FieldValue, and as an instance keeps it.
    const asList = EntityListFieldValueSchema.safeParse(list);
    const asFieldValue = FieldValueSchema.safeParse(list);
    const asInstanceField = InstanceEntityFieldSchema.safeParse({
      fieldKey: 'sponsors',
      entityReference: list,
    });

    // Assert: accepted every way, unchanged.
    expect(asList.data, 'the list must be accepted as sent').toEqual(list);
    expect(asFieldValue.data, 'it must be a FieldValue as well').toEqual(list);
    expect(
      asInstanceField.data?.entityReference,
      'an instance on air must be able to keep it, so an edit refreshes it',
    ).toEqual(list);
  });

  const refusedLists = [
    // The teams on air come from a source (the tower, the standings), never the library.
    { name: 'refuses every team', list: { kind: 'entityList', entityType: 'team' } },
    // No graphic shows every person at once.
    { name: 'refuses every person', list: { kind: 'entityList', entityType: 'person' } },
    // A record key would read as "this one sponsor", which is the entity reference's job.
    {
      name: 'refuses a sponsor id beside it',
      list: { kind: 'entityList', entityType: 'sponsor', sponsorId: 'bosch' },
    },
    // An attribute would read as "only the names", which a list does not offer.
    {
      name: 'refuses an attribute beside it',
      list: { kind: 'entityList', entityType: 'sponsor', attribute: 'logoUrl' },
    },
  ];

  it.each(refusedLists)('$name', ({ list }) => {
    // Arrange: the list of this row.

    // Act: check it.
    const result = EntityListFieldValueSchema.safeParse(list);

    // Assert: refused.
    expect(result.success, 'the list must be refused').toBe(false);
  });
});
