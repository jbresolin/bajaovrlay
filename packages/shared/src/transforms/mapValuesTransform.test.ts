/**
 * The value table (packages/shared)
 *
 * What this module is for:
 *   Every timing system has its own codes: "BOX" for a car in the pits, "RUN" for a clock
 *   that is running, 4 for a red flag. mapValues is a table from those codes to the
 *   canonical values ("inPit", true, "red"), so a flex source's mapping can translate them.
 *   It is the one transform with parameters: the table itself.
 *
 * What these tests prove:
 *   - Text is looked up as it is, and the table may give any JSON value, a boolean too.
 *   - A number or boolean from the source is looked up by its JSON text, 4 as "4".
 *   - A value missing from the table is refused with a reason naming it, never passed
 *     through, and so is a value that cannot be looked up (null, an object).
 *   - A key the object inherits ("constructor") is not in the table.
 *   - A table that is not an object, or is empty, is refused by the transform's own
 *     schema, which checkTransformParameters runs when a config is saved.
 *
 * What these tests deliberately do not cover:
 *   - Whether the table's values are canonical ("inPit" is a status, "parado" is not):
 *     the canonical validation after the mapping checks that.
 */
import { describe, expect, it } from 'vitest';

import { checkTransformParameters } from './checkTransformParameters.js';
import { mapValuesTransform } from './mapValuesTransform.js';
import type { TransformResult } from './transform.js';

/** The status table of the fictional timing system in flexMapping/examples. */
const timingSystemStatusTable = { PISTA: 'running', BOX: 'inPit', ABAND: 'retired' };

/** A run code that feeds clock.running. */
const clockRunCodeTable = { RUN: true, STOP: false };

/** A numeric flag code, as a timing system sends a flag. */
const flagCodeTable = { '1': 'green', '2': 'yellow', '4': 'red' };

describe('mapValues', () => {
  const mapValuesScenarios: Array<{
    name: string;
    value: unknown;
    table: Record<string, unknown>;
    expected: TransformResult;
  }> = [
    // The headline case: a status code turned into the canonical status.
    {
      name: 'a car the timing system marks BOX comes out inPit',
      value: 'BOX',
      table: timingSystemStatusTable,
      expected: { ok: true, value: 'inPit' },
    },
    // The table may give a boolean, so the source's own run code can feed clock.running.
    {
      name: 'the run code RUN comes out as the boolean true',
      value: 'RUN',
      table: clockRunCodeTable,
      expected: { ok: true, value: true },
    },
    // A false from the table is a value like any other, not "missing".
    {
      name: 'the run code STOP comes out as the boolean false',
      value: 'STOP',
      table: clockRunCodeTable,
      expected: { ok: true, value: false },
    },
    // A number from the source is looked up by its JSON text: 4 as "4".
    {
      name: 'the numeric flag code 4 is looked up as "4" and comes out red',
      value: 4,
      table: flagCodeTable,
      expected: { ok: true, value: 'red' },
    },
    // A boolean from the source is looked up as "true".
    {
      name: 'a boolean true from the source is looked up as "true"',
      value: true,
      table: { true: 'running', false: 'inPit' },
      expected: { ok: true, value: 'running' },
    },
    // A code the table does not know must stop the poll, not reach the air as it is.
    {
      name: 'refuses a status code the table does not know, naming it',
      value: 'DESCL',
      table: timingSystemStatusTable,
      expected: { ok: false, reason: '"DESCL" não está na tabela de valores' },
    },
    // A numeric code missing from the table is named as the number it was.
    {
      name: 'refuses the flag code 3, which the table does not list',
      value: 3,
      table: flagCodeTable,
      expected: { ok: false, reason: '3 não está na tabela de valores' },
    },
    // "constructor" is a member every object inherits; it must not count as a row.
    {
      name: 'refuses "constructor", which only the object inherits',
      value: 'constructor',
      table: timingSystemStatusTable,
      expected: { ok: false, reason: '"constructor" não está na tabela de valores' },
    },
    // An object has no JSON text to look up.
    {
      name: 'refuses an object, which cannot be looked up',
      value: { codigo: 'BOX' },
      table: timingSystemStatusTable,
      expected: {
        ok: false,
        reason:
          '{"codigo":"BOX"} não pode ser procurado na tabela de valores, que só procura textos, números e verdadeiro/falso',
      },
    },
  ];

  it.each(mapValuesScenarios)('$name', ({ value, table, expected }) => {
    // Arrange: the value this row's source sent, and the table its mapping holds.

    // Act: look the value up.
    const result = mapValuesTransform.apply(value, table);

    // Assert: the table's value, or the refusal with its pt-BR reason.
    expect(result, 'mapValues must translate or refuse as this row says').toEqual(expected);
  });

  const refusedTableScenarios: Array<{ name: string; table: unknown; expectedReason: string }> = [
    // A list is no table: the operator typed rows without their codes.
    {
      name: 'refuses a list given as the table',
      table: ['inPit', 'running'],
      expectedReason:
        'A tabela de valores deve ser um objeto JSON como { "BOX": "inPit", "PISTA": "running" }.',
    },
    // No parameters at all: the operator picked the transform and filled nothing.
    {
      name: 'refuses a missing table',
      table: undefined,
      expectedReason:
        'A tabela de valores deve ser um objeto JSON como { "BOX": "inPit", "PISTA": "running" }.',
    },
    // An empty table refuses every value, so every poll would fail.
    {
      name: 'refuses an empty table',
      table: {},
      expectedReason: 'A tabela de valores está vazia.',
    },
  ];

  it.each(refusedTableScenarios)('$name', ({ table, expectedReason }) => {
    // Arrange: a mapping rule that names mapValues with this row's table.

    // Act: check the parameters as the config schema does when the source is saved.
    const check = checkTransformParameters('mapValues', table, 'mapping');

    // Assert: refused, with the pt-BR sentence saying what is wrong with the table.
    expect(check, 'the table must be refused with this reason').toEqual({
      ok: false,
      reason: expectedReason,
    });
  });

  it('refuses every value at poll time when its table was never checked, without throwing', () => {
    // Arrange: a table that is a list, as if a config had skipped its check.
    const uncheckedTable = ['inPit', 'running'];

    // Act: look a status up in it.
    const result = mapValuesTransform.apply('BOX', uncheckedTable);

    // Assert: a refusal naming the transform, not a crash in the poll.
    expect(result, 'a bad table must give a refusal, not a throw').toEqual({
      ok: false,
      reason: 'Os parâmetros da transformação "Tabela de valores" são inválidos.',
    });
  });
});
