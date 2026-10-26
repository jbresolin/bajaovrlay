/**
 * The fields a flex mapping can fill in the brackets shape (packages/shared)
 *
 * What this module is for:
 *   A source sends an elimination as a flat list of matches, one element per match, as the
 *   Baja app's `tournament` table keeps it (BAJAOVRLAY-25). The flex form shows one row per
 *   field of such a match, and the config refuses a rule whose target is not one of them;
 *   `listMappableFieldsOfShape('brackets')` is that list.
 *
 * What these tests prove:
 *   - The list is fixed, field by field: the shape's own two, then each match's round, id
 *     and carA (required), then the rest; every field of carB is optional, since a bye has
 *     none.
 *   - Every listed field exists in the shapes' Zod schemas and is required there exactly
 *     when the list says so (a field inside the optional carB is never required), and every
 *     field of those schemas is listed but the rounds, which are built from the matches'
 *     round names.
 *
 * What these tests deliberately do not cover:
 *   - Grouping the mapped matches into rounds: applyFlexMappingBrackets.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  BracketMatchSchema,
  BracketRoundSchema,
  BracketsShapeSchema,
} from '../dataShapes/bracketsShape.js';
import { listMappableFieldsOfShape } from './mappableFields.js';
import { findFieldSchema, listFieldNamesOfSchema } from './shapeSchemaFields.testSupport.js';

/**
 * One bracket match as a flex source maps it: the match's own fields, plus the two that
 * name its round, which the mapping uses to group the matches and then takes off.
 */
const MappedBracketMatchSchema = z.object({
  ...BracketMatchSchema.shape,
  roundName: BracketRoundSchema.shape.name,
  roundIsThirdPlace: BracketRoundSchema.shape.isThirdPlace,
});

describe('listMappableFieldsOfShape for brackets', () => {
  it('lists the brackets fields: the whole shape, then each match with its round and two cars', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the brackets fields.
    const bracketsFields = listMappableFieldsOfShape('brackets');

    // Assert: exactly these, in this order; carB is optional whole, since a bye has none.
    expect(bracketsFields, 'the brackets fields must be this fixed list').toEqual([
      {
        targetField: 'sessionId',
        label: 'Identificador da sessão',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'updatedAtMs',
        label: 'Momento da atualização',
        isRequired: true,
        level: 'topLevel',
      },
      { targetField: 'roundName', label: 'Fase', isRequired: true, level: 'entry' },
      {
        targetField: 'matchId',
        label: 'Identificador da disputa',
        isRequired: true,
        level: 'entry',
      },
      { targetField: 'carA.carNumber', label: 'Carro A › Carro', isRequired: true, level: 'entry' },
      { targetField: 'carA.teamName', label: 'Carro A › Equipe', isRequired: true, level: 'entry' },
      {
        targetField: 'carA.schoolName',
        label: 'Carro A › Escola',
        isRequired: true,
        level: 'entry',
      },
      {
        targetField: 'roundIsThirdPlace',
        label: 'Fase é a disputa de 3º lugar',
        isRequired: false,
        level: 'entry',
      },
      { targetField: 'bestOf', label: 'Melhor de N', isRequired: false, level: 'entry' },
      { targetField: 'walkover', label: 'Vitória por W.O.', isRequired: false, level: 'entry' },
      {
        targetField: 'winnerCarNumber',
        label: 'Vencedor (carro)',
        isRequired: false,
        level: 'entry',
      },
      { targetField: 'carA.timeMs', label: 'Carro A › Tempo', isRequired: false, level: 'entry' },
      { targetField: 'carA.wins', label: 'Carro A › Vitórias', isRequired: false, level: 'entry' },
      {
        targetField: 'carB.carNumber',
        label: 'Carro B › Carro',
        isRequired: false,
        level: 'entry',
      },
      {
        targetField: 'carB.teamName',
        label: 'Carro B › Equipe',
        isRequired: false,
        level: 'entry',
      },
      {
        targetField: 'carB.schoolName',
        label: 'Carro B › Escola',
        isRequired: false,
        level: 'entry',
      },
      { targetField: 'carB.timeMs', label: 'Carro B › Tempo', isRequired: false, level: 'entry' },
      { targetField: 'carB.wins', label: 'Carro B › Vitórias', isRequired: false, level: 'entry' },
    ]);
  });

  it('names only fields of the shapes, each required exactly as listed', () => {
    // Arrange: the brackets fields.
    const bracketsFields = listMappableFieldsOfShape('brackets');

    // Act: find each field's own schema, at its level.
    const fieldChecks = bracketsFields.map((field) => {
      const objectSchema =
        field.level === 'topLevel' ? BracketsShapeSchema : MappedBracketMatchSchema;
      return { field, fieldFound: findFieldSchema(objectSchema, field.targetField) };
    });

    // Assert: every field exists, and a missing value is refused exactly when it is required.
    for (const { field, fieldFound } of fieldChecks) {
      expect(fieldFound, `${field.targetField} must exist in its shape schema`).toBeDefined();
      expect(
        fieldFound?.isRequiredAlongItsPath,
        `${field.targetField} must be required in its schema exactly when the list says so`,
      ).toBe(field.isRequired);
    }
  });

  it('lists every field of the shapes but the rounds, which the round names build', () => {
    // Arrange: the target names the list offers, and the schemas' own field names.
    const listedTargetFields = listMappableFieldsOfShape('brackets').map(
      (field) => field.targetField,
    );
    const schemaFieldNames = [
      ...listFieldNamesOfSchema(BracketsShapeSchema).filter((name) => name !== 'rounds'),
      ...listFieldNamesOfSchema(MappedBracketMatchSchema),
    ];

    // Act: sort both, since the list has its own order.
    const sortedListed = [...listedTargetFields].sort();
    const sortedInSchema = [...schemaFieldNames].sort();

    // Assert: the same names on both sides.
    expect(sortedListed, 'the list must offer every field of the schemas').toEqual(sortedInSchema);
  });
});
