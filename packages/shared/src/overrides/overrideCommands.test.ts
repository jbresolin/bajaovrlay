/**
 * Setting and clearing an override, as commands (packages/shared)
 *
 * What this module is for:
 *   An operator corrects what a source says with setOverride ("Corrigir valor…") and
 *   takes the correction away with clearOverride ("Remover correção"). An override is
 *   keyed by a session field, or by a car and one of its fields, and always carries a
 *   reason, so the next operator knows why the screen differs from the source.
 *
 * What these tests prove:
 *   - A session name correction and a car's team name correction are accepted as sent.
 *   - A correction with a blank reason is refused, naming reason.
 *   - A car correction with no car number, a session correction with one, and a field
 *     that is not correctable for its scope are refused, each naming the part.
 *   - clearOverride is accepted for a session field and for a car's field.
 *
 * What these tests deliberately do not cover:
 *   - Whether the value fits the field; overrideValue.test.ts.
 *   - What the server does with them; the override tests of apps/server.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';

describe('setOverride and clearOverride in the command union', () => {
  const acceptedCommands = [
    // The organisers renamed the session; the simulator still sends the old name.
    {
      name: 'accepts a correction of the session name',
      command: {
        type: 'setOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'sessionName',
        value: 'Enduro — Etapa Nacional',
        reason: 'Nome oficial da prova.',
      },
    },
    // The timing system misspells the team of car 42.
    {
      name: "accepts a correction of car 42's team name",
      command: {
        type: 'setOverride',
        sourceId: 'cronometragem',
        scope: 'car',
        carNumber: 42,
        field: 'teamName',
        value: 'Jequitibá Racing',
        reason: 'A cronometragem escreve "Jequitiba".',
      },
    },
    // "Remover correção" on the session name.
    {
      name: 'accepts clearing the session name correction',
      command: {
        type: 'clearOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'sessionName',
      },
    },
    // "Remover correção" on car 42's team.
    {
      name: "accepts clearing car 42's team name correction",
      command: {
        type: 'clearOverride',
        sourceId: 'cronometragem',
        scope: 'car',
        carNumber: 42,
        field: 'teamName',
      },
    },
  ];

  it.each(acceptedCommands)('$name', ({ command }) => {
    // Arrange: the command of this row.

    // Act: check it.
    const result = CommandSchema.safeParse(command);

    // Assert: accepted as sent.
    expect(result.success, 'the command must be accepted').toBe(true);
    expect(result.data, 'the command must not be altered').toEqual(command);
  });

  const refusedCommands = [
    // A correction nobody explained confuses the next operator.
    {
      name: 'refuses a correction with a blank reason, naming reason',
      command: {
        type: 'setOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'sessionName',
        value: 'Enduro',
        reason: '   ',
      },
      partNamed: 'reason',
    },
    // A car correction must say which car.
    {
      name: 'refuses a car correction with no car number, naming carNumber',
      command: {
        type: 'setOverride',
        sourceId: 'cronometragem',
        scope: 'car',
        field: 'teamName',
        value: 'Jequitibá Racing',
        reason: 'Nome errado.',
      },
      partNamed: 'carNumber',
    },
    // A session correction does not follow a car; a number there would be ignored.
    {
      name: 'refuses a session correction carrying a car number, naming carNumber',
      command: {
        type: 'setOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        carNumber: 42,
        field: 'sessionName',
        value: 'Enduro',
        reason: 'Nome oficial.',
      },
      partNamed: 'carNumber',
    },
    // A team name is a car's field, not the session's.
    {
      name: 'refuses a session correction of a car field, naming field',
      command: {
        type: 'setOverride',
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'teamName',
        value: 'Jequitibá Racing',
        reason: 'Nome errado.',
      },
      partNamed: 'field',
    },
    // Laps are not correctable: one changed alone would break the order of the list.
    {
      name: 'refuses a correction of a car laps, naming field',
      command: {
        type: 'setOverride',
        sourceId: 'cronometragem',
        scope: 'car',
        carNumber: 42,
        field: 'laps',
        value: 30,
        reason: 'Volta não contada.',
      },
      partNamed: 'field',
    },
  ];

  it.each(refusedCommands)('$name', ({ command, partNamed }) => {
    // Arrange: the command of this row.

    // Act: check it and read the failure.
    const result = CommandSchema.safeParse(command);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the part.
    expect(result.success, 'the command must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the part').toContain(partNamed);
  });
});
