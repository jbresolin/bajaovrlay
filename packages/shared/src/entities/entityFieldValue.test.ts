/**
 * The entity reference: an item field that reads a record of the library (packages/shared)
 *
 * What this module is for:
 *   An item field may say "the team name of car 42" instead of holding a typed text: the
 *   FieldValue kind `entity` (BAJAOVRLAY-19). It names the kind of record, the record by
 *   its fixed key (a team by car number; a person, sponsor or schedule slot by id) and
 *   one attribute of it. It is always live: an edit of the record reaches the air.
 *
 * What these tests prove:
 *   - A reference to car 42's team name, to a person's photo by id, to a sponsor's logo
 *     and to a schedule slot's start are accepted, as entity references and as FieldValues.
 *   - A team reference with no car number, one with a personId instead, one with a value
 *     beside it, and one with a blank attribute are refused: the schema is strict, so a
 *     misspelt key is refused rather than dropped.
 *
 * What these tests deliberately do not cover:
 *   - Whether the attribute exists and fits the field; entityFitsGraphicField.test.ts.
 *   - Reading the value; entityReferenceResolution.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { FieldValueSchema } from '../rundown/fieldValue.js';
import { EntityFieldValueSchema } from './entityFieldValue.js';

describe('EntityFieldValueSchema', () => {
  const acceptedReferences = [
    // The team card's title: the team of car 42, by its car number.
    {
      name: "accepts car 42's team name",
      reference: { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'teamName' },
    },
    // A lower third's photo of the narrator.
    {
      name: "accepts the narrator's photo, by id",
      reference: {
        kind: 'entity',
        entityType: 'person',
        personId: 'narrador-joao',
        attribute: 'photoUrl',
      },
    },
    // The sponsor bug's logo.
    {
      name: "accepts the master sponsor's logo, by id",
      reference: {
        kind: 'entity',
        entityType: 'sponsor',
        sponsorId: 'patrocinador-master',
        attribute: 'logoUrl',
      },
    },
    // A countdown to the next session.
    {
      name: "accepts the enduro slot's start, by id",
      reference: {
        kind: 'entity',
        entityType: 'scheduleSlot',
        slotId: 'enduro-sabado',
        attribute: 'startsAtMs',
      },
    },
  ];

  it.each(acceptedReferences)('$name', ({ reference }) => {
    // Arrange: the reference of this row.

    // Act: check it alone and as a FieldValue.
    const asReference = EntityFieldValueSchema.safeParse(reference);
    const asFieldValue = FieldValueSchema.safeParse(reference);

    // Assert: accepted both ways, unchanged.
    expect(asReference.data, 'the reference must be accepted as sent').toEqual(reference);
    expect(asFieldValue.data, 'it must be a FieldValue as well').toEqual(reference);
  });

  const refusedReferences = [
    // A team is chosen by its car number; without one there is no team.
    {
      name: 'refuses a team reference with no car number',
      reference: { kind: 'entity', entityType: 'team', attribute: 'teamName' },
    },
    // A personId on a team reference is a page bug, not a team.
    {
      name: 'refuses a team reference that names a person instead',
      reference: {
        kind: 'entity',
        entityType: 'team',
        personId: 'narrador-joao',
        attribute: 'teamName',
      },
    },
    // A value typed beside the reference would be believed and never shown.
    {
      name: 'refuses a reference with a value beside it',
      reference: {
        kind: 'entity',
        entityType: 'team',
        carNumber: 42,
        attribute: 'teamName',
        value: 'Baja UFPR',
      },
    },
    // An attribute is needed to know what to read.
    {
      name: 'refuses a blank attribute',
      reference: { kind: 'entity', entityType: 'team', carNumber: 42, attribute: '' },
    },
  ];

  it.each(refusedReferences)('$name', ({ reference }) => {
    // Arrange: the reference of this row.

    // Act: check it.
    const result = EntityFieldValueSchema.safeParse(reference);

    // Assert: refused.
    expect(result.success, 'the reference must be refused').toBe(false);
  });
});
