/**
 * Values typed into the flex form (apps/control)
 *
 * What this module is for:
 *   A "Valor fixo" and the right column of a value table take any JSON value: the
 *   source's "RUN" becomes true, "BOX" becomes "inPit", a fixed scope is "overall". The
 *   form reads what reads as JSON as that JSON and anything else as plain text, so the
 *   operator writes inPit, not "inPit"; writing a value back gives text that reads the
 *   same again, so an imported config shows in the form exactly as it will be saved.
 *
 * What these tests prove:
 *   - Bare words are text, true / false / numbers are themselves, quotes keep a text.
 *   - Writing every kind of value and reading it back gives the same value.
 *
 * What these tests deliberately do not cover:
 *   - Where these values go in the config: flexSourceFormReading.test.ts.
 */
import type { JsonValue } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { readTypedValueText, writeTypedValueText } from './typedValueText';

const readingScenarios: { name: string; typedText: string; expected: JsonValue }[] = [
  // The everyday case: a canonical status typed without quotes.
  { name: 'reads inPit as the text "inPit"', typedText: 'inPit', expected: 'inPit' },
  // The run code of the clock: a yes/no, not the word "true".
  { name: 'reads true as a yes', typedText: 'true', expected: true },
  // A number stays a number: a fixed scheduled duration in ms.
  { name: 'reads 14400000 as a number', typedText: '14400000', expected: 14_400_000 },
  // Quotes keep a number-looking text a text: a session id "2027".
  { name: 'reads "2027" in quotes as a text', typedText: '"2027"', expected: '2027' },
  // Spaces around a word are a typing slip, not part of the value.
  { name: 'trims the spaces around a word', typedText: '  overall ', expected: 'overall' },
  // A word with a space in it is still one text: an event name.
  {
    name: 'reads a phrase with spaces as one text',
    typedText: 'Etapa Nacional',
    expected: 'Etapa Nacional',
  },
];

describe('readTypedValueText', () => {
  it.each(readingScenarios)('$name', ({ typedText, expected }) => {
    // Arrange: the text as the operator typed it (in the scenario).

    // Act: read it.
    const value = readTypedValueText(typedText);

    // Assert: the JSON value the config will hold.
    expect(value, `"${typedText}" must read as ${JSON.stringify(expected)}`).toEqual(expected);
  });
});

const roundTripScenarios: { name: string; value: JsonValue; expectedText: string }[] = [
  // A plain word is written bare, as the operator would type it.
  { name: 'writes the text inPit bare', value: 'inPit', expectedText: 'inPit' },
  // A yes/no is written as the word JSON uses.
  { name: 'writes false as false', value: false, expectedText: 'false' },
  // A text that would read as a number keeps its quotes, so it stays a text.
  { name: 'writes the text "42" in quotes', value: '42', expectedText: '"42"' },
  // A text that would read as a yes/no keeps its quotes too.
  { name: 'writes the text "true" in quotes', value: 'true', expectedText: '"true"' },
  // A text with end spaces keeps them only inside quotes.
  { name: 'writes a text with end spaces in quotes', value: ' BOX', expectedText: '" BOX"' },
  // A number is written as JSON writes it.
  { name: 'writes 4.5 as 4.5', value: 4.5, expectedText: '4.5' },
];

describe('writeTypedValueText', () => {
  it.each(roundTripScenarios)('$name, and reads it back the same', ({ value, expectedText }) => {
    // Arrange: a value as a stored config holds it (in the scenario).

    // Act: write it into a field, then read the field again.
    const writtenText = writeTypedValueText(value);
    const valueReadBack = readTypedValueText(writtenText);

    // Assert: the text shown, and the very same value after reading it.
    expect(writtenText, 'the field must show the value as the operator would type it').toBe(
      expectedText,
    );
    expect(valueReadBack, 'reading the field back must give the stored value').toEqual(value);
  });
});
