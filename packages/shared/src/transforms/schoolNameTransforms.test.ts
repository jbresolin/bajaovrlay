/**
 * shortenSchoolName: a school name that fits its box (packages/shared)
 *
 * What this module is for:
 *   A team card has room for so many letters. shortenSchoolName cuts a school name to the
 *   maximum length its `maxLength` parameter states (4 to 60), at the last whole word
 *   that fits when there is one, and marks the cut with "…". It never guesses an
 *   abbreviation ("Universidade Federal do Paraná" never becomes "UFPR"): a wrong guess
 *   on air is worse than a cut name, and the short form belongs in the source.
 *
 * What these tests prove:
 *   - A name that fits is kept as it is, also at exactly the maximum.
 *   - A longer one is cut at the last whole word that fits, "…" included in the count,
 *     or inside the word when not even the first word fits.
 *   - Anything but text is refused, quoting it; maxLength is checked at save time.
 *
 * What these tests deliberately do not cover:
 *   - Team names; the transform reads any text, the name only says what it is for.
 */
import { describe, expect, it } from 'vitest';

import { checkTransformParameters } from './checkTransformParameters.js';
import { shortenSchoolNameTransform } from './schoolNameTransforms.js';
import type { TransformResult } from './transform.js';

describe('shortenSchoolName', () => {
  const schoolNameScenarios: Array<{
    name: string;
    value: unknown;
    maxLength: number;
    expected: TransformResult;
  }> = [
    // The short form the shapes carry: nothing to do.
    {
      name: 'keeps "UFPR" as it is',
      value: 'UFPR',
      maxLength: 12,
      expected: { ok: true, value: 'UFPR' },
    },
    // Exactly the maximum fits.
    {
      name: 'keeps "Escola Politécnica" at exactly 18 letters',
      value: 'Escola Politécnica',
      maxLength: 18,
      expected: { ok: true, value: 'Escola Politécnica' },
    },
    // The cut lands on a space: the whole words before it stay.
    {
      name: 'cuts "Universidade Federal do Paraná" to "Universidade Federal do…" at 24',
      value: 'Universidade Federal do Paraná',
      maxLength: 24,
      expected: { ok: true, value: 'Universidade Federal do…' },
    },
    // The cut lands inside "Federal": back to the last whole word.
    {
      name: 'cuts "Universidade Federal do Paraná" to "Universidade…" at 20',
      value: 'Universidade Federal do Paraná',
      maxLength: 20,
      expected: { ok: true, value: 'Universidade…' },
    },
    // Not even the first word fits: cut inside it rather than show nothing.
    {
      name: 'cuts "Universidade" to "Unive…" at 6',
      value: 'Universidade',
      maxLength: 6,
      expected: { ok: true, value: 'Unive…' },
    },
    // A number where the school name was expected: the wrong path.
    {
      name: 'refuses 42, quoting it',
      value: 42,
      maxLength: 12,
      expected: { ok: false, reason: '42 não é um texto' },
    },
  ];

  it.each(schoolNameScenarios)('$name', ({ value, maxLength, expected }) => {
    // Arrange: the school name and the room of this row.

    // Act: shorten it.
    const result = shortenSchoolNameTransform.apply(value, { maxLength });

    // Assert: the name as it goes on air, or the refusal.
    expect(result, 'the name must be shortened as this row says').toEqual(expected);
  });

  it('checks maxLength when the item is saved: a whole number from 4 to 60', () => {
    // Arrange: a box of three letters, too small for any name plus "…".
    const parameters = { maxLength: 3 };

    // Act: check it as an item save does.
    const check = checkTransformParameters('shortenSchoolName', parameters, 'binding');

    // Assert: refused with the range.
    expect(check, 'maxLength must be from 4 to 60').toEqual({
      ok: false,
      reason: 'O tamanho máximo deve ser um inteiro de 4 a 60 letras.',
    });
  });
});
