/**
 * The value table's "otherwise" value (packages/shared)
 *
 * What this module is for:
 *   The Baja app's results API says its word lists (a clock's state, a car's status, a
 *   bracket slot's type) may gain words at any time (BAJAOVRLAY-53). A mapValues table can
 *   then say what a word it does not list becomes: its parameters take a second form,
 *   `{ "table": { … }, "otherwiseValue": … }`, beside the plain table, which keeps working.
 *
 * What these tests prove:
 *   - A word the table lists still takes the table's value when an otherwise value is given.
 *   - A word the table does not list takes the otherwise value, false included.
 *   - Without an otherwise value, a word the table does not list is still refused.
 *   - The second form is checked like the first when a config is saved: an empty table, a
 *     table that is not an object, or a misspelt key is refused. The key "otherwiseValue"
 *     is what says a table is in the second form.
 *
 * What these tests deliberately do not cover:
 *   - The plain table's own rows (codes, numbers, booleans, "constructor");
 *     mapValuesTransform.test.ts covers them.
 */
import { describe, expect, it } from 'vitest';

import { checkTransformParameters } from './checkTransformParameters.js';
import { mapValuesTransform } from './mapValuesTransform.js';
import type { TransformResult } from './transform.js';

/** The Baja API's clock states turned into clock.running, every other word stopped. */
const clockRunningTableWithOtherwise = {
  table: { running: true, red_flag: true },
  otherwiseValue: false,
};

/** The Baja API's bracket round numbers turned into "is the third place", any other false. */
const thirdPlaceTableWithOtherwise = { table: { '-1': true }, otherwiseValue: false };

describe('mapValues with an otherwise value', () => {
  const otherwiseScenarios: Array<{
    name: string;
    value: unknown;
    parameters: unknown;
    expected: TransformResult;
  }> = [
    // A word the table lists is unaffected by the otherwise value.
    {
      name: 'a running clock still comes out true from the table',
      value: 'running',
      parameters: clockRunningTableWithOtherwise,
      expected: { ok: true, value: true },
    },
    // The case the brief serves: a word the table does not list takes the otherwise value.
    {
      name: 'a waiting clock, which the table does not list, comes out false',
      value: 'waiting',
      parameters: clockRunningTableWithOtherwise,
      expected: { ok: true, value: false },
    },
    // A word the API adds later is handled the same way, rather than failing every poll.
    {
      name: 'a word the API adds later ("suspended") comes out false',
      value: 'suspended',
      parameters: clockRunningTableWithOtherwise,
      expected: { ok: true, value: false },
    },
    // A number is looked up by its text, then falls back like a word: round 0 is the final.
    {
      name: 'round 0, the final, is not the third place',
      value: 0,
      parameters: thirdPlaceTableWithOtherwise,
      expected: { ok: true, value: false },
    },
    // And the listed number still wins: round -1 is the match for third place.
    {
      name: 'round -1 is the third place',
      value: -1,
      parameters: thirdPlaceTableWithOtherwise,
      expected: { ok: true, value: true },
    },
    // Without an otherwise value the table refuses as it always has (the plain form).
    {
      name: 'refuses a word the plain table does not list, as before',
      value: 'suspended',
      parameters: { running: true, red_flag: true },
      expected: { ok: false, reason: '"suspended" não está na tabela de valores' },
    },
    // A value that has no text to look up is still refused: null is not a word.
    {
      name: 'refuses an object even with an otherwise value, since it has no text to look up',
      value: { state: 'running' },
      parameters: clockRunningTableWithOtherwise,
      expected: {
        ok: false,
        reason:
          '{"state":"running"} não pode ser procurado na tabela de valores, que só procura textos, números e verdadeiro/falso',
      },
    },
  ];

  it.each(otherwiseScenarios)('$name', ({ value, parameters, expected }) => {
    // Arrange: the value this row's source sent, and the table its rule holds.

    // Act: look the value up.
    const result = mapValuesTransform.apply(value, parameters);

    // Assert: the table's value, the otherwise value, or the refusal.
    expect(result, 'mapValues must translate, fall back or refuse as this row says').toEqual(
      expected,
    );
  });

  it('accepts the table with an otherwise value when a config is saved', () => {
    // Arrange: the clock table with its otherwise value.

    // Act: check it as the config schema does.
    const check = checkTransformParameters('mapValues', clockRunningTableWithOtherwise, 'mapping');

    // Assert: accepted.
    expect(check, 'a table with an otherwise value must be accepted').toEqual({ ok: true });
  });

  const refusedScenarios: Array<{ name: string; parameters: unknown; expectedReason: string }> = [
    // An empty table with an otherwise value would map every word to one value: a mistake.
    {
      name: 'refuses an empty table even with an otherwise value',
      parameters: { table: {}, otherwiseValue: false },
      expectedReason: 'A tabela de valores está vazia.',
    },
    // The table itself must still be an object of words.
    {
      name: 'refuses a list given as the table beside an otherwise value',
      parameters: { table: ['running'], otherwiseValue: false },
      expectedReason:
        'A tabela de valores deve ser um objeto JSON como { "BOX": "inPit", "PISTA": "running" }.',
    },
    // "otherwiseValue" says this is the second form, so a misspelt "table" is caught.
    {
      name: 'refuses a misspelt "table" beside an otherwise value',
      parameters: { tabela: { running: true }, otherwiseValue: false },
      expectedReason:
        'Com um valor "senão" (otherwiseValue), a tabela vai em "table": { "table": { "BOX": "inPit" }, "otherwiseValue": "running" }.',
    },
  ];

  it.each(refusedScenarios)('$name', ({ parameters, expectedReason }) => {
    // Arrange: a rule naming mapValues with this row's parameters.

    // Act: check them as the config schema does when the source is saved.
    const check = checkTransformParameters('mapValues', parameters, 'mapping');

    // Assert: refused, with the sentence saying what is wrong.
    expect(check, 'the parameters must be refused with this reason').toEqual({
      ok: false,
      reason: expectedReason,
    });
  });
});
