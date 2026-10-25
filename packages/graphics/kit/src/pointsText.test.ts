/**
 * A score as the boards write it (packages/graphics/kit)
 *
 * What this module is for:
 *   The standings and the intermission's top five write every score as the design pages do:
 *   a decimal comma and at most two decimals ("903,48", "312,5"), the typographic minus for
 *   SEG. and PEN. ("−15"). One function, moved here from the standings (BAJAOVRLAY-46).
 *
 * What these tests prove:
 *   - The number format of the design (buildSampleData.mjs `writePoints`), row by row on
 *     real values of the 30th competition's export.
 *
 * What these tests deliberately do not cover:
 *   - The cells around a score (a missing part, a disqualified team); the standings'
 *     standingsText.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { writePointsAsText } from './pointsText.js';

const pointsFormatScenarios = [
  // Two decimals, as most totals are: Equipe FEI Baja's 903.48.
  { name: 'writes 903.48 with a decimal comma', points: 903.48, expected: '903,48' },
  // The zero after the comma is dropped, as the design writes Baja UFMG's total.
  { name: 'drops the trailing zero of 921.80', points: 921.8, expected: '921,8' },
  // A whole score has no comma at all: the 4X4 bonus.
  { name: 'writes a whole 150 without a comma', points: 150, expected: '150' },
  // SEG. is negative: the typographic minus, never the hyphen.
  { name: 'writes −15 with the typographic minus', points: -15, expected: '−15' },
  // A fractional penalty keeps both its minus and its comma.
  { name: 'writes −12.5 with the minus and the comma', points: -12.5, expected: '−12,5' },
  // A score with more decimals than the board shows is rounded to two.
  { name: 'rounds 206.254 to two decimals', points: 206.254, expected: '206,25' },
  // A tiny negative that rounds to nothing is a plain 0, not "−0".
  { name: 'writes a negative that rounds to zero as 0', points: -0.001, expected: '0' },
  // Zero is a real score (PEN. 0), shown as 0.
  { name: 'writes zero as 0', points: 0, expected: '0' },
];

describe('writePointsAsText', () => {
  it.each(pointsFormatScenarios)('$name', ({ points, expected }) => {
    // Arrange: the score as the source sends it (the scenario's number).

    // Act: write it for the board.
    const text = writePointsAsText(points);

    // Assert: it reads as the design page writes it.
    expect(text, 'the score must be written as the design pages write it').toBe(expected);
  });
});
