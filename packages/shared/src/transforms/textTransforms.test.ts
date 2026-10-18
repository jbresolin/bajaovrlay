/**
 * Cleaning up text (packages/shared)
 *
 * What this module is for:
 *   Team and school names typed into a sheet or a timing system often carry stray spaces
 *   at the ends ("  Baja UFPR "). trimText removes them so the names on air line up.
 *
 * What these tests prove:
 *   - The spaces, tabs and line breaks at either end go, and the ones inside stay.
 *   - A value that is not text is refused, quoting it.
 *
 * What these tests deliberately do not cover:
 *   - A name that is empty after trimming: the canonical validation refuses it for a
 *     required name, and its own tests cover that.
 */
import { describe, expect, it } from 'vitest';

import { trimTextTransform } from './textTransforms.js';
import type { TransformResult } from './transform.js';

describe('trimText', () => {
  const trimTextScenarios: Array<{ name: string; value: unknown; expected: TransformResult }> = [
    // A name typed with spaces around it in a sheet.
    {
      name: 'removes the spaces around "  Baja UFPR "',
      value: '  Baja UFPR ',
      expected: { ok: true, value: 'Baja UFPR' },
    },
    // A tab and a line break, as a copy from a spreadsheet cell brings.
    {
      name: 'removes a tab and a line break at the ends',
      value: '\tMangue Baja\n',
      expected: { ok: true, value: 'Mangue Baja' },
    },
    // The spaces inside a name are part of it.
    {
      name: 'keeps the spaces inside "Universidade Federal do Paraná"',
      value: 'Universidade Federal do Paraná',
      expected: { ok: true, value: 'Universidade Federal do Paraná' },
    },
    // A car number is not text; the mapping should have no transform here.
    {
      name: 'refuses the car number 42, which is not text',
      value: 42,
      expected: { ok: false, reason: '42 não é um texto' },
    },
  ];

  it.each(trimTextScenarios)('$name', ({ value, expected }) => {
    // Arrange: the text this row's source sent.

    // Act: run the transform on it.
    const result = trimTextTransform.apply(value, undefined);

    // Assert: the trimmed text, or the refusal with its pt-BR reason.
    expect(result, 'trimText must trim or refuse as this row says').toEqual(expected);
  });
});
