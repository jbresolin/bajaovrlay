/**
 * Which attributes of the library fit a graphic's field (packages/shared)
 *
 * What this module is for:
 *   An entity reference stores one attribute of a record on one field of a graphic. The
 *   attribute must fit the field (BAJAOVRLAY-19): a text attribute on a string field, a
 *   whole number on an integer or number field, and an image URL only on a string field
 *   whose manifest marks it `v_baja.role: imageUrl` (the convention for image fields,
 *   packages/graphics/README.md). The item editor lists only the attributes that fit, and
 *   the server refuses a save of one that does not, with the same sentence.
 *
 * What these tests prove:
 *   - An image field is offered the team's logo and car photo and nothing else.
 *   - A plain text field is offered the team's text attributes, never its images.
 *   - An integer field is offered the car number.
 *   - A boolean field, a field with a fixed list of values (an enum) and a field the
 *     schema does not declare are offered nothing.
 *   - The save check refuses an unknown attribute and an image on a text field, naming
 *     them in pt-BR, and accepts the team name on a text field.
 *
 * What these tests deliberately do not cover:
 *   - Whether the record exists; the server's save check (itemEntityFields.test.ts).
 */
import { describe, expect, it } from 'vitest';

import {
  findProblemInEntityReferenceForDataSchemaField,
  listAttributesThatFitDataSchemaField,
} from './entityFitsGraphicField.js';

/** The data schema of a team card: a title, a school line, a logo, a car number, a switch. */
const teamCardDataSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Equipe' },
    schoolLine: { type: 'string', title: 'Escola' },
    logoUrl: { type: 'string', title: 'Logo', v_baja: { role: 'imageUrl' } },
    carNumber: { type: 'integer', title: 'Carro' },
    showLogo: { type: 'boolean', title: 'Mostrar logo' },
    flag: { type: 'string', title: 'Bandeira', enum: ['green', 'yellow', 'red'] },
  },
};

describe('listAttributesThatFitDataSchemaField', () => {
  const offeredAttributes = [
    // An image field takes images only, never a name that would be read as a URL.
    {
      name: 'offers images only on an image field',
      fieldKey: 'logoUrl',
      expected: ['logoUrl', 'carPhotoUrl'],
    },
    // A text field takes every text of the team, never an image URL.
    {
      name: 'offers the texts of a team on a text field',
      fieldKey: 'title',
      expected: ['teamName', 'schoolName', 'schoolFullName', 'city', 'state'],
    },
    // A whole number of the team.
    {
      name: 'offers the car number on an integer field',
      fieldKey: 'carNumber',
      expected: ['carNumber'],
    },
    // Nothing of a team is yes or no.
    { name: 'offers nothing on a boolean field', fieldKey: 'showLogo', expected: [] },
    // A fixed list (the flag) takes its own values only, which no text of a team is.
    {
      name: 'offers nothing on a field with a fixed list of values',
      fieldKey: 'flag',
      expected: [],
    },
    // A key the manifest does not declare takes nothing.
    {
      name: 'offers nothing on a field the schema does not declare',
      fieldKey: 'sponsor',
      expected: [],
    },
  ];

  it.each(offeredAttributes)('$name', ({ fieldKey, expected }) => {
    // Arrange: the team card's schema and the field of this row.

    // Act: list the team attributes that fit.
    const attributes = listAttributesThatFitDataSchemaField('team', teamCardDataSchema, fieldKey);

    // Assert: exactly these, in the library's order.
    expect(
      attributes.map((attribute) => attribute.attributeKey),
      `the attributes offered on ${fieldKey}`,
    ).toEqual(expected);
  });
});

describe('findProblemInEntityReferenceForDataSchemaField', () => {
  it('accepts the team name on the title', () => {
    // Arrange: car 42's team name, on the title.

    // Act: check it.
    const problem = findProblemInEntityReferenceForDataSchemaField(
      { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'teamName' },
      teamCardDataSchema,
      'title',
    );

    // Assert: no problem.
    expect(problem, 'a text on a text field fits').toBeUndefined();
  });

  it('refuses a logo on the title, naming the attribute', () => {
    // Arrange: car 42's logo, on a plain text field.

    // Act: check it.
    const problem = findProblemInEntityReferenceForDataSchemaField(
      { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'logoUrl' },
      teamCardDataSchema,
      'title',
    );

    // Assert: refused; a URL on a title would show the address as the team's name.
    expect(problem, 'an image on a text field does not fit').toBe(
      'Equipe › Logo não serve para este campo.',
    );
  });

  it('refuses an attribute teams do not have', () => {
    // Arrange: a "points" attribute, which no team has.

    // Act: check it.
    const problem = findProblemInEntityReferenceForDataSchemaField(
      { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'points' },
      teamCardDataSchema,
      'title',
    );

    // Assert: refused, naming the attribute.
    expect(problem, 'an unknown attribute is refused').toBe(
      'o cadastro de Equipe não tem o campo "points".',
    );
  });
});
