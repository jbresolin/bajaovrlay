/**
 * The pt-BR sentence for bad data (packages/graphics/kit)
 *
 * What this module is for:
 *   When a renderer sends a graphic data it refuses, `load` or `updateAction` answers 400
 *   with one pt-BR sentence the operator can act on: which field is missing, unknown or
 *   wrong. Every graphic words the four sentences in its own catalog; the kit chooses which
 *   one applies and names the field.
 *
 * What these tests prove:
 *   - Something that is not an object at all gets the "not an object" sentence.
 *   - A field the graphic does not know is named in the "unknown field" sentence.
 *   - A required field left out is named in the "missing field" sentence.
 *   - A field with a wrong value is named in the "invalid field" sentence, and inside a list
 *     the entry's index is part of the name (`entries[1].carNumber`).
 *
 * What these tests deliberately do not cover:
 *   - Each graphic's own wording; the graphics' model tests check their sentences.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { type DataProblemSentences, describeFirstDataProblemInPortuguese } from './dataProblems.js';

/** The sentences of a team card's catalog, as a graphic would word them. */
const teamCardSentences: DataProblemSentences = {
  notAnObject: 'Dados inválidos: era esperado um objeto com os dados do cartão.',
  missingField: (fieldName) => `Falta o campo obrigatório "${fieldName}".`,
  unknownField: (fieldName) => `Campo desconhecido nos dados: "${fieldName}".`,
  invalidField: (fieldName) => `Valor inválido no campo "${fieldName}".`,
};

const teamCardSchema = z.strictObject({
  carNumber: z.int().min(1),
  teamName: z.string(),
  entries: z.array(z.object({ carNumber: z.int().min(1) })).optional(),
});

const badDataScenarios = [
  {
    // A renderer sending a bare string instead of the data object.
    name: 'says the data is not an object when it is a string',
    input: 'Baja UFPR',
    expected: 'Dados inválidos: era esperado um objeto com os dados do cartão.',
  },
  {
    // A typo in a field name is the most common operator mistake.
    name: 'names a field the graphic does not know',
    input: { carNumber: 42, teamName: 'Baja UFPR', teamNmae: 'Baja UFPR' },
    expected: 'Campo desconhecido nos dados: "teamNmae".',
  },
  {
    // A required field left out entirely.
    name: 'names a required field that is missing',
    input: { carNumber: 42 },
    expected: 'Falta o campo obrigatório "teamName".',
  },
  {
    // A field present with the wrong kind of value.
    name: 'names a field with a wrong value',
    input: { carNumber: 0, teamName: 'Baja UFPR' },
    expected: 'Valor inválido no campo "carNumber".',
  },
  {
    // Inside a list the operator needs to know which entry is wrong.
    name: 'names the entry of a list by its index',
    input: { carNumber: 42, teamName: 'Baja UFPR', entries: [{ carNumber: 7 }, { carNumber: -3 }] },
    expected: 'Valor inválido no campo "entries[1].carNumber".',
  },
];

describe('describeFirstDataProblemInPortuguese', () => {
  it.each(badDataScenarios)('$name', ({ input, expected }) => {
    // Arrange: the schema's own verdict on the input of the row.
    const parsed = teamCardSchema.safeParse(input);
    if (parsed.success) {
      throw new Error('the scenario must hold bad data');
    }

    // Act: turn the first problem into a sentence.
    const sentence = describeFirstDataProblemInPortuguese(input, parsed.error, teamCardSentences);

    // Assert: the sentence the catalog words for that kind of problem, naming the field.
    expect(sentence, 'the operator must read which field is wrong and how').toBe(expected);
  });
});
