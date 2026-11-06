/**
 * The history sentences of the commands that changes the preview output only (packages/shared)
 *
 * What this module is for:
 *   The history page (#/historico, BAJAOVRLAY-30) reads every change of the show back in
 *   plain pt-BR, one named formatter per command type (sentencesOfPreviews.ts), naming
 *   things as the operator reads them: item labels in quotes, a layer with its output.
 *
 * What these tests prove:
 *   - For each command type of this group, a real race-day command reads as the exact
 *     sentence below; what is gone since reads by its id with a word saying so.
 *   - Every command type of the group has a row here.
 *
 * What these tests deliberately do not cover:
 *   - That every command type has a formatter and a group at all;
 *     sentenceOfEachCommandType.test.ts checks the registry against CommandSchema.
 *   - Rows read from the event log (refusals, trimmed payloads, layers touched);
 *     describeEventLogEntry.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { type CommandInput, CommandSchema } from '../commands/command.js';
import { commandGroupOfEachCommandType } from './eventLogCommandGroups.js';
import { buildEventLogNamesOfRaceDay } from './eventLogNamesOfRaceDay.testSupport.js';
import { describeCommand } from './sentenceOfEachCommandType.js';

const sentenceScenarios: Array<{ name: string; command: CommandInput; expected: string }> = [
  // "Prévia automática" is marked, since nobody pressed anything.
  {
    name: 'previewItem of an automatic preview is marked so',
    command: { type: 'previewItem', itemId: 'item-relogio-enduro', origin: 'auto' },
    expected: 'Pôs em prévia "Relógio – Enduro" na camada Relógio (Programa) (prévia automática)',
  },
  // "Descartar" of one layer's preview.
  {
    name: 'stopPreview of one layer names it',
    command: { type: 'stopPreview', layerId: 'lower-third' },
    expected: 'Descartou a prévia da camada Tarja (Programa)',
  },
  // The "vai limpar" marker.
  {
    name: 'previewClearLayer reads as the "vai limpar" marker',
    command: { type: 'previewClearLayer', layerId: 'notice' },
    expected: 'Marcou a camada Aviso (Programa) para limpar na próxima tomada',
  },
  // A macro's "Prévia".
  {
    name: 'previewMacro names the macro',
    command: { type: 'previewMacro', macroId: 'macro-abertura' },
    expected: 'Pôs em prévia a macro "Abertura"',
  },
];

describe('the sentences of the group "previews"', () => {
  it('has a row below for every command type of the group', () => {
    // Arrange: the command types the group holds.
    const typesOfTheGroup = Object.entries(commandGroupOfEachCommandType)
      .filter(([, group]) => group === 'previews')
      .map(([commandType]) => commandType);

    // Act: list the types the table covers.
    const typesInTheTable = new Set<string>(
      sentenceScenarios.map((scenario) => scenario.command.type),
    );

    // Assert: none is left without a row.
    const typesWithoutARow = typesOfTheGroup.filter(
      (commandType) => !typesInTheTable.has(commandType),
    );
    expect(typesWithoutARow, 'each command type of the group must have a row below').toEqual([]);
  });

  it.each(sentenceScenarios)('$name', ({ command, expected }) => {
    // Arrange: the command checked as the server checks it, and the race day's names.
    const validCommand = CommandSchema.parse(command);
    const names = buildEventLogNamesOfRaceDay();

    // Act: write its history sentence.
    const sentence = describeCommand(validCommand, names);

    // Assert: exactly the sentence the operator reads.
    expect(sentence, 'the history must read the command in these words').toBe(expected);
  });
});
