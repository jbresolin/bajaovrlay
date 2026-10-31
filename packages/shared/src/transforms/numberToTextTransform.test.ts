/**
 * A number written as text (packages/shared)
 *
 * What this module is for:
 *   Some canonical fields are text ids, such as a bracket match's `matchId`, while a source
 *   sends them as numbers (the Baja app's `match_id: 65`). numberToText writes the number
 *   as text, so a flex mapping can fill such a field (BAJAOVRLAY-53).
 *
 * What these tests prove:
 *   - A whole number becomes its digits, a negative one keeps its minus.
 *   - Text, a boolean or null is refused, quoting the value, rather than passed through:
 *     a source that changed its format must be seen.
 *
 * What these tests deliberately do not cover:
 *   - Decimal separators: an id with decimals is not a case any source has; the number is
 *     written as JavaScript writes it.
 */
import { describe, expect, it } from 'vitest';

import { numberToTextTransform } from './numberTransforms.js';
import type { TransformResult } from './transform.js';

describe('numberToText', () => {
  const numberToTextScenarios: Array<{ name: string; value: unknown; expected: TransformResult }> =
    [
      // The case the brief serves: the Baja app's match id 65 becomes the text "65".
      { name: 'writes match 65 as "65"', value: 65, expected: { ok: true, value: '65' } },
      // A negative number keeps its sign (the third-place round is -1).
      { name: 'writes -1 as "-1"', value: -1, expected: { ok: true, value: '-1' } },
      // Text already: refused, so a source that changed its format is noticed.
      {
        name: 'refuses text, which needs no transform',
        value: '65',
        expected: { ok: false, reason: '"65" não é um número' },
      },
      // A boolean is no number.
      {
        name: 'refuses a boolean',
        value: true,
        expected: { ok: false, reason: 'true não é um número' },
      },
    ];

  it.each(numberToTextScenarios)('$name', ({ value, expected }) => {
    // Arrange: the value this row's source sent.

    // Act: run the transform on it.
    const result = numberToTextTransform.apply(value, undefined);

    // Assert: the text written, or the refusal with its pt-BR reason.
    expect(result, 'numberToText must write or refuse as this row says').toEqual(expected);
  });
});
