/**
 * topN: the first entries of a list (packages/shared)
 *
 * What this module is for:
 *   A positions tower that shows the top six binds the whole positions list and keeps
 *   its first six entries with topN (parameter n, 1 to 60). It is a binding transform:
 *   it shapes canonical data for a graphic, it never reads a source's own format.
 *
 * What these tests prove:
 *   - topN keeps the first n entries in their order, and a list shorter than n whole.
 *   - Anything but a list is refused with a pt-BR reason quoting it.
 *   - n is checked when the item is saved: 1 and 60 pass, 0, 61 and 2.5 are refused.
 *
 * What these tests deliberately do not cover:
 *   - Which paths topN may be used on; bindingProblems.test.ts checks the types.
 */
import { describe, expect, it } from 'vitest';

import { checkTransformParameters } from './checkTransformParameters.js';
import { topNTransform } from './topNTransform.js';

// The context every binding transform is handed since BAJAOVRLAY-47; this one ignores it.
const contextWithNoTeams = { teams: [] };

/** The first four cars of the enduro at lap 34, as the positions shape lists them. */
function buildFirstFourCarsOfTheEnduro() {
  return [
    { position: 1, carNumber: 31, teamName: 'Acauã Baja', schoolName: 'Mauá', laps: 34 },
    { position: 2, carNumber: 38, teamName: 'Coruja Racing', schoolName: 'EESC-USP', laps: 34 },
    { position: 3, carNumber: 25, teamName: 'Bem-te-vi Off-Road', schoolName: 'UFES', laps: 33 },
    { position: 4, carNumber: 78, teamName: 'Arara Off-Road', schoolName: 'UNIFEI', laps: 33 },
  ];
}

describe('topN', () => {
  it('keeps the first three cars, in their order', () => {
    // Arrange: the first four cars and a tower showing three.
    const cars = buildFirstFourCarsOfTheEnduro();

    // Act: keep the first three.
    const result = topNTransform.apply(cars, { n: 3 }, contextWithNoTeams);

    // Assert: cars 31, 38 and 25, the leader first.
    expect(result, 'the first three cars must be kept in order').toEqual({
      ok: true,
      value: cars.slice(0, 3),
    });
  });

  it('keeps a list shorter than n whole', () => {
    // Arrange: four cars and a tower showing ten (a small session).
    const cars = buildFirstFourCarsOfTheEnduro();

    // Act: keep the first ten.
    const result = topNTransform.apply(cars, { n: 10 }, contextWithNoTeams);

    // Assert: all four, nothing invented.
    expect(result, 'a short list must be kept as it is').toEqual({ ok: true, value: cars });
  });

  it('refuses a value that is not a list, quoting it', () => {
    // Arrange: a session name bound by mistake to a transform for lists.
    const sessionName = 'Enduro de Resistência';

    // Act: run topN on it.
    const result = topNTransform.apply(sessionName, { n: 6 }, contextWithNoTeams);

    // Assert: refused with the reason the operator reads.
    expect(result, 'a text must be refused').toEqual({
      ok: false,
      reason: '"Enduro de Resistência" não é uma lista',
    });
  });

  const parameterScenarios = [
    // The smallest top: only the leader.
    { name: 'accepts n = 1', parameters: { n: 1 }, expected: { ok: true } },
    // The largest: a full 60-car field.
    { name: 'accepts n = 60', parameters: { n: 60 }, expected: { ok: true } },
    // An empty top shows nothing, which is a mistake rather than a choice.
    {
      name: 'refuses n = 0, below the range',
      parameters: { n: 0 },
      expected: { ok: false, reason: 'O número de entradas deve ser um inteiro de 1 a 60.' },
    },
    // More than any field of Baja cars.
    {
      name: 'refuses n = 61, above the range',
      parameters: { n: 61 },
      expected: { ok: false, reason: 'O número de entradas deve ser um inteiro de 1 a 60.' },
    },
    // Half a car.
    {
      name: 'refuses n = 2.5, not a whole number',
      parameters: { n: 2.5 },
      expected: { ok: false, reason: 'O número de entradas deve ser um inteiro de 1 a 60.' },
    },
  ];

  it.each(parameterScenarios)('$name', ({ parameters, expected }) => {
    // Arrange: the parameters of this row.

    // Act: check them as an item save does.
    const check = checkTransformParameters('topN', parameters, 'binding');

    // Assert: accepted or refused as the row says.
    expect(check, 'n must be a whole number from 1 to 60').toEqual(expected);
  });
});
