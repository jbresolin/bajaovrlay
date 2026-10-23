/**
 * The "Cadastro" choices of a field, as the form holds them (apps/control)
 *
 * What this module is for:
 *   A field of the item editor set to "Cadastro" reads one attribute of one record of the
 *   entity library (BAJAOVRLAY-19). While the operator chooses, the form holds plain
 *   texts: the kind of record, the record's key (a car number as text, or an id) and the
 *   attribute. Checking the form turns them into the entity reference the item stores,
 *   or a pt-BR message under the field naming what is missing, with the same fit rule the
 *   server applies at the save.
 *
 * What these tests prove:
 *   - Car 7's team name on the title, and the narrator's role, read as references.
 *   - A reference filled into the form reads back as itself.
 *   - Nothing chosen, a kind with no record, and a record with no attribute each get their
 *     own message.
 *   - A logo on the title is refused with the shared fit sentence.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the controls; SchemaFormFieldsEntityReference.test.tsx.
 *   - Whether the record exists now; the "Valor agora" line and the server's save.
 */
import { describe, expect, it } from 'vitest';

import {
  buildSchemaFormEntityReferenceValueFromReference,
  emptySchemaFormEntityReferenceValue,
  readEntityReferenceFromSchemaFormValue,
} from './entityReferenceFormValue';
import {
  buildTeamCardFixtureDataSchema,
  describeTeamCardFixture,
} from './teamCardFixtureSchema.testSupport';

/** The title field of the team card. */
function findTitleField() {
  const titleField = describeTeamCardFixture().fields.find((field) => field.key === 'titulo');
  if (titleField === undefined) {
    throw new Error('the team card has a title');
  }
  return titleField;
}

describe('readEntityReferenceFromSchemaFormValue', () => {
  it("reads car 7's team name chosen for the title", () => {
    // Arrange: the choices as the controls leave them.
    const value = { entityType: 'team' as const, recordKey: '7', attribute: 'teamName' };

    // Act: read them.
    const reading = readEntityReferenceFromSchemaFormValue(
      findTitleField(),
      value,
      buildTeamCardFixtureDataSchema(),
    );

    // Assert: the reference the item stores, the car as a number.
    expect(reading, 'the reference').toEqual({
      status: 'reference',
      reference: { kind: 'entity', entityType: 'team', carNumber: 7, attribute: 'teamName' },
    });
  });

  it("reads the narrator's role by his id", () => {
    // Arrange: the narrator chosen, his role.
    const value = { entityType: 'person' as const, recordKey: 'narrador-joao', attribute: 'role' };

    // Act: read it.
    const reading = readEntityReferenceFromSchemaFormValue(
      findTitleField(),
      value,
      buildTeamCardFixtureDataSchema(),
    );

    // Assert: a person by id.
    expect(reading, 'the reference').toEqual({
      status: 'reference',
      reference: {
        kind: 'entity',
        entityType: 'person',
        personId: 'narrador-joao',
        attribute: 'role',
      },
    });
  });

  it('reads back a reference filled into the form', () => {
    // Arrange: a stored reference to car 42's city.
    const stored = {
      kind: 'entity' as const,
      entityType: 'team' as const,
      carNumber: 42,
      attribute: 'city',
    };

    // Act: fill the form from it, then read the form.
    const reading = readEntityReferenceFromSchemaFormValue(
      findTitleField(),
      buildSchemaFormEntityReferenceValueFromReference(stored),
      buildTeamCardFixtureDataSchema(),
    );

    // Assert: the same reference.
    expect(reading, 'nothing lost on the way').toEqual({ status: 'reference', reference: stored });
  });

  const incompleteChoices = [
    // "Cadastro" chosen, nothing else yet.
    {
      name: 'asks for the kind of record when none is chosen',
      value: emptySchemaFormEntityReferenceValue,
      expectedMessage: 'Título: escolha o tipo de cadastro.',
    },
    // A kind, but no team picked.
    {
      name: 'asks for the record when only the kind is chosen',
      value: { entityType: 'team' as const, recordKey: '', attribute: '' },
      expectedMessage: 'Título: escolha o cadastro.',
    },
    // A team, but not what of it to show.
    {
      name: 'asks for the attribute when only the record is chosen',
      value: { entityType: 'team' as const, recordKey: '7', attribute: '' },
      expectedMessage: 'Título: escolha o campo do cadastro.',
    },
    // A URL on the title would print the address as the team's name.
    {
      name: 'refuses a logo on the title with the shared fit sentence',
      value: { entityType: 'team' as const, recordKey: '42', attribute: 'logoUrl' },
      expectedMessage: 'Título: Equipe › Logo não serve para este campo.',
    },
  ];

  it.each(incompleteChoices)('$name', ({ value, expectedMessage }) => {
    // Arrange: the choices of this row.

    // Act: read them.
    const reading = readEntityReferenceFromSchemaFormValue(
      findTitleField(),
      value,
      buildTeamCardFixtureDataSchema(),
    );

    // Assert: the message under the field.
    expect(reading, 'the message').toEqual({ status: 'problem', message: expectedMessage });
  });
});
