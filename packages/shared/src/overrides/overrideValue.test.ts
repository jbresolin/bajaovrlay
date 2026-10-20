/**
 * Whether a corrected value fits its field (packages/shared)
 *
 * What this module is for:
 *   An override's value goes on air wherever the field is bound, so it must be what the
 *   canonical shape would hold there: a text for a name, one of the flags for the session
 *   state, one of the statuses for a car, a number for a duration. findProblemInOverrideValue
 *   checks it with the shapes' own field schemas and answers one pt-BR sentence naming
 *   the field, or undefined. The server runs it at setOverride; the control page before
 *   sending.
 *
 * What these tests prove:
 *   - A session name, a flag, a car status, a school and a scheduled duration that fit pass.
 *   - A number as a session name, an unknown flag, an empty team name, a duration written
 *     as text and an unknown status are refused, each naming the field.
 *
 * What these tests deliberately do not cover:
 *   - Which fields may be corrected at all; overrideCommands.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { findProblemInOverrideValue } from './overrideValue.js';

describe('findProblemInOverrideValue', () => {
  const valuesThatFit = [
    // The case the brief's walk uses.
    { name: 'a session name', scope: 'session', field: 'sessionName', value: 'Enduro — Final' },
    // A flag the race clock knows.
    { name: 'the red flag', scope: 'session', field: 'state', value: 'red' },
    // A car that stopped though the source says it runs.
    { name: 'a car stopped', scope: 'car', field: 'status', value: 'stopped' },
    // Points with a decimal, as Baja scores them.
    { name: 'a school name', scope: 'car', field: 'schoolName', value: 'CEFET-MG' },
    // Four hours in ms.
    {
      name: 'a scheduled duration in ms',
      scope: 'session',
      field: 'scheduledDurationMs',
      value: 14_400_000,
    },
  ] as const;

  it.each(valuesThatFit)('passes $name', ({ scope, field, value }) => {
    // Arrange: the value of this row.

    // Act: check it.
    const problem = findProblemInOverrideValue(scope, field, value);

    // Assert: it fits.
    expect(problem, 'a value that fits must pass').toBeUndefined();
  });

  const valuesThatDoNotFit = [
    // A number where a text goes.
    {
      name: 'refuses a number as the session name',
      scope: 'session',
      field: 'sessionName',
      value: 42,
      expected: 'O valor 42 não serve para Sessão › Nome da sessão.',
    },
    // A flag the graphics do not know.
    {
      name: 'refuses an unknown flag',
      scope: 'session',
      field: 'state',
      value: 'azul',
      expected: 'O valor "azul" não serve para Sessão › Bandeira.',
    },
    // An empty name would show nothing on air.
    {
      name: 'refuses an empty team name',
      scope: 'car',
      field: 'teamName',
      value: '',
      expected: 'O valor "" não serve para Carro › Equipe.',
    },
    // A duration typed as text.
    {
      name: 'refuses a scheduled duration written as text',
      scope: 'session',
      field: 'scheduledDurationMs',
      value: '4:00:00',
      expected: 'O valor "4:00:00" não serve para Sessão › Duração prevista.',
    },
    // A status in Portuguese instead of the shape's word.
    {
      name: 'refuses an unknown status',
      scope: 'car',
      field: 'status',
      value: 'parado',
      expected: 'O valor "parado" não serve para Carro › Situação.',
    },
  ] as const;

  it.each(valuesThatDoNotFit)('$name', ({ scope, field, value, expected }) => {
    // Arrange: the value of this row.

    // Act: check it.
    const problem = findProblemInOverrideValue(scope, field, value);

    // Assert: refused, naming the field.
    expect(problem, 'a value that does not fit must be named').toBe(expected);
  });
});
