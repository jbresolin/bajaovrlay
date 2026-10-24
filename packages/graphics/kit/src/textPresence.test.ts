/**
 * Whether a graphic's optional text is given (packages/graphics/kit)
 *
 * What this module is for:
 *   The notice, the lower third and the team card each draw a part only when its text is
 *   given, and they had one copy of the rule each. The rule lives here once.
 *
 * What these tests prove:
 *   - A text with a letter in it is given, spaces around it included.
 *   - No text, an empty text and a text of blanks are not given.
 *
 * What these tests deliberately do not cover:
 *   - What each graphic leaves out when a text is missing; their view tests.
 */
import { describe, expect, it } from 'vitest';

import { isTextGiven } from './textPresence.js';

const textScenarios = [
  // A role as typed.
  { name: 'gives a role as typed', text: 'Narradora', expected: true },
  // A CSV cell often carries spaces around the city.
  { name: 'gives a city with spaces around it', text: '  Joinville ', expected: true },
  // A field the record does not have.
  { name: 'does not give a text left out', text: undefined, expected: false },
  // A field cleared to nothing.
  { name: 'does not give an empty text', text: '', expected: false },
  // A field cleared by typing spaces must not leave an empty box on air.
  { name: 'does not give a text of blanks', text: '   ', expected: false },
];

describe('isTextGiven', () => {
  it.each(textScenarios)('$name', ({ text, expected }) => {
    // Arrange: the text comes from the scenario row above.

    // Act: ask whether it is given.
    const isGiven = isTextGiven(text);

    // Assert: as the row says.
    expect(isGiven, 'a text is given only when it has something to show').toBe(expected);
  });
});
