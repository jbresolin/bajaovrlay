/**
 * The entity library's commands: upsertEntity, deleteEntity, importEntities (packages/shared)
 *
 * What this module is for:
 *   The Cadastros page changes the library with three commands, operators only. Each
 *   names its entityType, and the record (or its key) is then checked by that type's own
 *   schema: a team by its car number, a person, sponsor or schedule slot by its id.
 *   importEntities carries the valid rows of a CSV (or the simulator's teams) as one
 *   batch, so a hundred teams are one state change, one event-log row and one broadcast.
 *
 * What these tests prove:
 *   - upsertEntity of a team and of a person, deleteEntity of a team by car number and of
 *     a sponsor by id, and importEntities of two teams are accepted as sent.
 *   - A record is checked by the schema of the type it names: a person's record sent as
 *     a team is refused at the missing car number.
 *   - A delete must carry the key of its type (a team's carNumber, not a personId).
 *   - An import with the same car twice, or with no record at all, is refused.
 *
 * What these tests deliberately do not cover:
 *   - The rules of each record; entityRecords.test.ts.
 *   - What the server does with them; the entity tests of apps/server.
 */
import { describe, expect, it } from 'vitest';

import { CommandSchema } from '../commands/command.js';

/** Team 42, Baja UFPR, as the Cadastros form sends it. */
function buildTeam42Record() {
  return {
    carNumber: 42,
    teamName: 'Baja UFPR',
    schoolName: 'UFPR',
    city: 'Curitiba',
    state: 'PR',
  };
}

/** Team 7, Juriti Off-Road. */
function buildTeam7Record() {
  return {
    carNumber: 7,
    teamName: 'Juriti Off-Road',
    schoolName: 'UDESC',
    city: 'Joinville',
    state: 'SC',
  };
}

describe('the entity commands in the command union', () => {
  const acceptedCommands = [
    // "Salvar" on the Equipes tab.
    {
      name: 'accepts upserting team 42',
      command: { type: 'upsertEntity', entityType: 'team', record: buildTeam42Record() },
    },
    // "Salvar" on the Pessoas tab.
    {
      name: 'accepts upserting the narrator',
      command: {
        type: 'upsertEntity',
        entityType: 'person',
        record: { personId: 'narrador-joao', name: 'João Bresolin', role: 'Narrador' },
      },
    },
    // "Excluir" twice on the row of car 42.
    {
      name: 'accepts deleting team 42 by its car number',
      command: { type: 'deleteEntity', entityType: 'team', carNumber: 42 },
    },
    // "Excluir" twice on a sponsor's row.
    {
      name: 'accepts deleting a sponsor by its id',
      command: { type: 'deleteEntity', entityType: 'sponsor', sponsorId: 'patrocinador-master' },
    },
    // "Importar" with the two valid rows of a CSV.
    {
      name: 'accepts importing two teams at once',
      command: {
        type: 'importEntities',
        entityType: 'team',
        records: [buildTeam42Record(), buildTeam7Record()],
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
    // A person's record sent under "team" must not become a team with no car.
    {
      name: "refuses a person's record sent as a team, at the car number",
      command: {
        type: 'upsertEntity',
        entityType: 'team',
        record: { personId: 'narrador-joao', name: 'João Bresolin', role: 'Narrador' },
      },
      expectedPath: ['record', 'carNumber'],
    },
    // A team is deleted by its car number; an id means nothing for it.
    {
      name: 'refuses deleting a team by an id',
      command: { type: 'deleteEntity', entityType: 'team', personId: 'narrador-joao' },
      expectedPath: ['carNumber'],
    },
    // A type the library does not have.
    {
      name: 'refuses an entity type the library does not have',
      command: { type: 'deleteEntity', entityType: 'vehicle', carNumber: 42 },
      expectedPath: ['entityType'],
    },
    // A CSV with car 42 on two lines: which one wins would be a guess.
    {
      name: 'refuses importing the same car twice',
      command: {
        type: 'importEntities',
        entityType: 'team',
        records: [buildTeam42Record(), { ...buildTeam42Record(), teamName: 'Baja UFPR B' }],
      },
      expectedPath: ['records', 1, 'carNumber'],
    },
    // "Importar" with nothing valid to import is a page bug, not an import.
    {
      name: 'refuses an import with no record',
      command: { type: 'importEntities', entityType: 'team', records: [] },
      expectedPath: ['records'],
    },
  ];

  it.each(refusedCommands)('$name', ({ command, expectedPath }) => {
    // Arrange: the command of this row.

    // Act: check it.
    const result = CommandSchema.safeParse(command);

    // Assert: refused at the part that is wrong.
    expect(result.success, 'the command must be refused').toBe(false);
    expect(result.error?.issues[0]?.path, 'the refusal must point at the wrong part').toEqual(
      expectedPath,
    );
  });
});
