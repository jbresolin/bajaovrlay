/**
 * The history sentences of the commands that sets the show up: outputs, layers and OBS’s connection (packages/shared)
 *
 * What this module is for:
 *   The history page (#/historico, BAJAOVRLAY-30) reads every change of the show back in
 *   plain pt-BR, one named formatter per command type (sentencesOfSettings.ts), naming
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
  // A new output: its name and the address it gets.
  {
    name: 'createOutput names the output and its address',
    command: { type: 'createOutput', outputId: 'camera-2', name: 'Câmera 2' },
    expected: 'Criou a saída "Câmera 2" (camera-2)',
  },
  // A rename, by the address, since the old name is gone.
  {
    name: 'renameOutput names the address and the new name',
    command: { type: 'renameOutput', outputId: 'pip', name: 'Câmera do box' },
    expected: 'Renomeou a saída pip para "Câmera do box"',
  },
  // A deleted output reads by its address.
  {
    name: 'deleteOutput reads the output by its address, since it is gone',
    command: { type: 'deleteOutput', outputId: 'camera-2' },
    expected: 'Excluiu a saída camera-2',
  },
  // Outputs dragged into a new order.
  {
    name: 'reorderOutputs has nothing to name',
    command: { type: 'reorderOutputs', orderedOutputIds: ['program', 'pip'] },
    expected: 'Reordenou as saídas',
  },
  // A new layer on the PiP output.
  {
    name: 'createLayer names the layer and its output',
    command: {
      type: 'createLayer',
      layerId: 'placar-do-box',
      outputId: 'pip',
      name: 'Placar do box',
      zIndex: 20,
      replacePolicy: 'cut',
      persistent: false,
    },
    expected: 'Criou a camada "Placar do box" na saída PiP',
  },
  // A layer's edit.
  {
    name: 'updateLayer names the layer and its output',
    command: { type: 'updateLayer', layerId: 'notice', persistent: true },
    expected: 'Editou a camada Aviso (Programa)',
  },
  // A layer moved: where it is (read now, so already on PiP) and where it went.
  {
    name: 'moveLayerToOutput names the layer and the output it went to',
    command: { type: 'moveLayerToOutput', layerId: 'camera-do-box', outputId: 'pip' },
    expected: 'Moveu a camada Câmera do box (PiP) para a saída PiP',
  },
  // Layers dragged into a new order within an output.
  {
    name: 'reorderLayers names the output',
    command: {
      type: 'reorderLayers',
      outputId: 'program',
      orderedLayerIds: ['clock', 'lower-third', 'notice', 'fullscreen'],
    },
    expected: 'Reordenou as camadas da saída Programa',
  },
  // A deleted layer reads by its id.
  {
    name: 'deleteLayer reads the layer by its id, since it is gone',
    command: { type: 'deleteLayer', layerId: 'placar-do-box' },
    expected: 'Excluiu a camada placar-do-box',
  },
  // OBS's connection dropping.
  {
    name: 'recordObsState names the connection state',
    command: {
      type: 'recordObsState',
      status: {
        connectionState: 'erro',
        address: 'ws://127.0.0.1:4455',
        lastError: 'Conexão recusada.',
        sceneNames: [],
        programSceneName: null,
        isStudioModeOn: false,
        previewSceneName: null,
      },
    },
    expected: 'A conexão com o OBS ficou com erro',
  },
];

describe('the sentences of the group "settings"', () => {
  it('has a row below for every command type of the group', () => {
    // Arrange: the command types the group holds.
    const typesOfTheGroup = Object.entries(commandGroupOfEachCommandType)
      .filter(([, group]) => group === 'settings')
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
