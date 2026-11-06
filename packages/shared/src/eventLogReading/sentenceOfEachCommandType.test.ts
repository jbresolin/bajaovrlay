/**
 * One history sentence per command type: the registry (packages/shared)
 *
 * What this module is for:
 *   The history page (#/historico, BAJAOVRLAY-30) reads every change of the show back in
 *   plain pt-BR. Each command type has one named formatter in a registry
 *   (sentenceOfEachCommandType.ts), never one big switch, and one command group for the
 *   page's filter (eventLogCommandGroups.ts).
 *
 * What these tests prove:
 *   - Every command type in CommandSchema has a formatter and a group, and neither names
 *     a type the schema has dropped: a new command fails here until it has both.
 *
 * What these tests deliberately do not cover:
 *   - Each sentence; sentencesOf<group>.test.ts holds a real row per command type, and
 *     each checks it covers every type of its group.
 */
import { describe, expect, it } from 'vitest';

import { CommandSchema } from '../commands/command.js';
import { commandGroupOfEachCommandType } from './eventLogCommandGroups.js';
import { sentenceOfEachCommandType } from './sentenceOfEachCommandType.js';

/**
 * Reads the `type` of every command schema in the union. A few commands (upsertEntity,
 * importEntities, deleteEntity) are unions of their own on the entity type; their first
 * member names the same type as the others.
 */
function readTypeOfEveryCommandInTheSchema(): string[] {
  const typesInTheSchema: string[] = [];
  for (const commandSchema of CommandSchema.options) {
    const schemaWithTheType = 'options' in commandSchema ? commandSchema.options[0] : commandSchema;
    typesInTheSchema.push(schemaWithTheType.shape.type.value);
  }
  return typesInTheSchema;
}

describe('the registry of history sentences', () => {
  it('has a formatter and a group for every command type, and for nothing else', () => {
    // Arrange: every command type the union lists.
    const typesInTheSchema = readTypeOfEveryCommandInTheSchema();

    // Act: list the types the registry and the groups name.
    const typesWithASentence = Object.keys(sentenceOfEachCommandType);
    const typesWithAGroup = Object.keys(commandGroupOfEachCommandType);

    // Assert: the same types everywhere, each once.
    expect(
      [...typesWithASentence].sort(),
      'every command must have its history sentence, and no stale type be kept',
    ).toEqual([...typesInTheSchema].sort());
    expect(
      [...typesWithAGroup].sort(),
      'every command must be in a filter group, and no stale type be kept',
    ).toEqual([...typesInTheSchema].sort());
  });
});
