/**
 * Numbers written as text (packages/shared)
 *
 * What this module is for:
 *   Many JSON APIs send numbers as text, and a Brazilian one writes the decimals with a
 *   comma: "12,5". textToNumber and textToInteger read that text into the numbers the
 *   canonical shapes hold, so a flex source's mapping can say "this field is a number".
 *
 * What these tests prove:
 *   - textToNumber reads the pt-BR comma and the point alike, and refuses ambiguous text
 *     such as "1.234,5" instead of guessing which separator is the decimal one.
 *   - textToInteger reads whole numbers only, and refuses a decimal rather than rounding.
 *   - Both refuse a value that is not text, quoting it in the reason.
 *
 * What these tests deliberately do not cover:
 *   - Where the value came from in the response; that is the mapping's job and its tests.
 */
import { describe, expect, it } from 'vitest';

import { textToIntegerTransform, textToNumberTransform } from './numberTransforms.js';
import type { TransformResult } from './transform.js';

type NumberTransformScenario = { name: string; value: unknown; expected: TransformResult };

describe('textToNumber', () => {
  const textToNumberScenarios: NumberTransformScenario[] = [
    // The pt-BR decimal comma, as a Brazilian timing system writes a distance.
    {
      name: 'reads "12,5" with a comma as 12.5',
      value: '12,5',
      expected: { ok: true, value: 12.5 },
    },
    // The point, as most JSON APIs write it, gives the same number.
    {
      name: 'reads "12.5" with a point as 12.5',
      value: '12.5',
      expected: { ok: true, value: 12.5 },
    },
    // A whole number needs no separator at all.
    { name: 'reads "34" as 34', value: '34', expected: { ok: true, value: 34 } },
    // A negative value, such as a time correction.
    { name: 'reads "-0,25" as -0.25', value: '-0,25', expected: { ok: true, value: -0.25 } },
    // Spaces around the number come from hand-typed sheets and are not part of it.
    {
      name: 'ignores the spaces at either end',
      value: ' 7,5 ',
      expected: { ok: true, value: 7.5 },
    },
    // Two separators: is it 1234.5 or 1.2345? Guessing wrong puts a false number on air.
    {
      name: 'refuses "1.234,5" as ambiguous instead of guessing',
      value: '1.234,5',
      expected: {
        ok: false,
        reason:
          '"1.234,5" é ambíguo: um número deve ter no máximo um separador decimal, vírgula ou ponto, e nenhum separador de milhar',
      },
    },
    // Text that is no number at all, such as a placeholder the source sends.
    {
      name: 'refuses "sem tempo", which is no number',
      value: 'sem tempo',
      expected: { ok: false, reason: '"sem tempo" não é um número' },
    },
    // An empty text is not zero.
    {
      name: 'refuses an empty text',
      value: '',
      expected: { ok: false, reason: '"" não é um número' },
    },
    // A number already: the mapping should have no transform, and saying so finds the mistake.
    {
      name: 'refuses a value that is already a number, saying it is not text',
      value: 12.5,
      expected: { ok: false, reason: '12.5 não é um texto' },
    },
  ];

  it.each(textToNumberScenarios)('$name', ({ value, expected }) => {
    // Arrange: the value this row's source sent, as it is.

    // Act: run the transform on it.
    const result = textToNumberTransform.apply(value, undefined);

    // Assert: the number read, or the refusal with its pt-BR reason.
    expect(result, 'textToNumber must read or refuse the text as this row says').toEqual(expected);
  });
});

describe('textToInteger', () => {
  const textToIntegerScenarios: NumberTransformScenario[] = [
    // The common case: a lap count sent as text.
    { name: 'reads the lap count "42" as 42', value: '42', expected: { ok: true, value: 42 } },
    // Zero laps is a real count at the start of a race.
    { name: 'reads "0" as 0', value: '0', expected: { ok: true, value: 0 } },
    // Spaces from a hand-typed sheet.
    { name: 'ignores the spaces at either end', value: ' 7 ', expected: { ok: true, value: 7 } },
    // A decimal means the wrong field was mapped; rounding it would hide that.
    {
      name: 'refuses "42,5" instead of rounding it',
      value: '42,5',
      expected: { ok: false, reason: '"42,5" não é um número inteiro' },
    },
    // Past 2^53 digits would be lost silently.
    {
      name: 'refuses a number too large to keep every digit',
      value: '90071992547409930',
      expected: {
        ok: false,
        reason: '"90071992547409930" é grande demais para ser lido sem perder dígitos',
      },
    },
    // A number already, as in textToNumber.
    {
      name: 'refuses a value that is already a number, saying it is not text',
      value: 42,
      expected: { ok: false, reason: '42 não é um texto' },
    },
  ];

  it.each(textToIntegerScenarios)('$name', ({ value, expected }) => {
    // Arrange: the value this row's source sent, as it is.

    // Act: run the transform on it.
    const result = textToIntegerTransform.apply(value, undefined);

    // Assert: the whole number read, or the refusal with its pt-BR reason.
    expect(result, 'textToInteger must read or refuse the text as this row says').toEqual(expected);
  });
});
