/**
 * The history sentences of the commands that prepares the show: items, rundowns, quick-fire panels and macros (packages/shared)
 *
 * What this module is for:
 *   The history page (#/historico, BAJAOVRLAY-30) reads every change of the show back in
 *   plain pt-BR, one named formatter per command type (sentencesOfItemsAndRundown.ts), naming
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
  // A new item reads by the label it was given and where it was put.
  {
    name: 'createItem names the label given and its rundown',
    command: {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'race-clock',
      layerId: 'clock',
      fields: { state: { kind: 'literal', value: 'yellow' } },
      label: 'Bandeira amarela',
    },
    expected: 'Criou o item "Bandeira amarela" no rundown "Sessão principal"',
  },
  // "Salvar" in the item editor.
  {
    name: 'updateItemFields names the item',
    command: { type: 'updateItemFields', itemId: 'item-tarja-ana-souza', notes: 'Entrevista' },
    expected: 'Editou o item "Tarja – Ana Souza"',
  },
  // A deleted item is gone from the names, so it reads by its id.
  {
    name: 'deleteItem reads the item by its id, since it is gone',
    command: { type: 'deleteItem', itemId: 'item-tarja-bruno-lima' },
    expected: 'Excluiu o item item excluído (item-tarja-bruno-lima)',
  },
  // Rows dragged into a new order.
  {
    name: 'reorderItems names the rundown',
    command: {
      type: 'reorderItems',
      rundownId: 'sessao-principal',
      orderedItemIds: ['item-relogio-enduro'],
    },
    expected: 'Reordenou o rundown "Sessão principal"',
  },
  // The arrows past the last row.
  {
    name: 'moveCursor to nothing reads as the end of the rundown',
    command: { type: 'moveCursor', rundownId: 'sessao-principal', itemId: null },
    expected: 'Moveu o cursor do rundown "Sessão principal" para o fim',
  },
  // A new tab of "Atalhos e macros".
  {
    name: 'createQuickFirePanel names the new panel',
    command: { type: 'createQuickFirePanel', name: 'Patrocinadores' },
    expected: 'Criou o painel de atalhos "Patrocinadores"',
  },
  // A rename reads the panel by its name now.
  {
    name: 'renameQuickFirePanel names the panel and the new name',
    command: { type: 'renameQuickFirePanel', panelId: 'atalhos', name: 'Atalhos da prova' },
    expected: 'Renomeou o painel de atalhos "Atalhos" para "Atalhos da prova"',
  },
  // A deleted panel is gone from the names.
  {
    name: 'deleteQuickFirePanel reads the panel by its id, since it is gone',
    command: { type: 'deleteQuickFirePanel', panelId: 'patrocinadores' },
    expected: 'Excluiu o painel de atalhos painel excluído (patrocinadores)',
  },
  // "Mover para rundown" from a shortcut button.
  {
    name: 'moveItemToHome names the item and where it went',
    command: {
      type: 'moveItemToHome',
      itemId: 'item-tarja-ana-souza',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      order: 1,
    },
    expected: 'Moveu "Tarja – Ana Souza" para o rundown "Sessão principal"',
  },
  // "Salvar no item" after an edit on air.
  {
    name: 'saveOnAirChangesIntoItem names what is on air',
    command: {
      type: 'saveOnAirChangesIntoItem',
      instanceId: 'instancia-tarja-ana-souza',
      wallClockFields: 'atTake',
    },
    expected:
      'Salvou no item o que foi alterado no ar em "Tarja – Ana Souza" na camada Tarja (Programa)',
  },
  // A new macro reads by the label given.
  {
    name: 'createMacro names the label given',
    command: { type: 'createMacro', label: 'Intervalo', steps: [] },
    expected: 'Criou a macro "Intervalo"',
  },
  // The macro editor's "Salvar".
  {
    name: 'updateMacro names the macro',
    command: { type: 'updateMacro', macroId: 'macro-abertura', label: 'Abertura do dia' },
    expected: 'Editou a macro "Abertura"',
  },
  // A deleted macro reads by its id.
  {
    name: 'deleteMacro reads the macro by its id, since it is gone',
    command: { type: 'deleteMacro', macroId: 'macro-podio' },
    expected: 'Excluiu a macro macro excluída (macro-podio)',
  },
];

describe('the sentences of the group "itemsAndRundown"', () => {
  it('has a row below for every command type of the group', () => {
    // Arrange: the command types the group holds.
    const typesOfTheGroup = Object.entries(commandGroupOfEachCommandType)
      .filter(([, group]) => group === 'itemsAndRundown')
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
