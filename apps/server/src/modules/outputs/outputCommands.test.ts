/**
 * The output commands: createOutput, renameOutput, deleteOutput, reorderOutputs
 * (apps/server)
 *
 * What this module is for:
 *   An output is a renderer address OBS loads as a browser source (BAJAOVRLAY-49):
 *   program (/render/) always, and any the operator adds on "Saídas e camadas", such as
 *   PiP (/render/?output=pip) for the scene with the camera box. These four commands add,
 *   rename, remove and order them; every refusal says in pt-BR what blocks it.
 *
 * What these tests prove (on the pure reducer, through reduceCommand):
 *   - createOutput adds an output after the last one, with no layer.
 *   - renameOutput changes the name only, program included; the same name changes
 *     nothing.
 *   - deleteOutput removes an output with no layer and closes the gap in the order.
 *   - reorderOutputs puts the outputs in the order given, numbered from 0.
 *   - Each refusal, one row per guard: an id already used, an output that does not
 *     exist, program, an output that still has layers (named), a reorder list that is not
 *     every output once.
 *
 * What these tests deliberately do not cover:
 *   - The layer commands; layerCommands.test.ts and deleteLayer.test.ts.
 *   - The event-log row, saving and who may send them; outputsThroughTheStore.test.ts.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from '../../core/store/reducers/reduceCommand.js';
import { contextOfTheRundownCommand } from '../../core/store/reducers/rundownSlices.testSupport.js';
import {
  buildPipOutput,
  buildProgramOutput,
  buildRaceDaySlicesWithPip,
} from './outputSlices.testSupport.js';

/** The same race day with program and PiP, but no PiP layer: an output that may go. */
function buildRaceDayWithAnEmptyPip() {
  const slices = buildRaceDaySlicesWithPip({});
  return { ...slices, layers: slices.layers.filter((layer) => layer.outputId !== 'pip') };
}

describe('createOutput', () => {
  it('adds the output after the last one, with no layer', () => {
    // Arrange: program and PiP.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: João adds "Câmera 2" for a second camera scene.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'createOutput', outputId: 'camera-2', name: 'Câmera 2' },
      contextOfTheRundownCommand,
    );

    // Assert: a third output at position 2, and the layers untouched.
    expect(outcome.status === 'applied' && outcome.slices.outputs, 'added after PiP').toEqual([
      buildProgramOutput(),
      buildPipOutput(),
      { outputId: 'camera-2', name: 'Câmera 2', order: 2 },
    ]);
    expect(
      outcome.status === 'applied' && outcome.slices.layers,
      'a new output starts with no layer',
    ).toBe(slicesBefore.layers);
  });
});

describe('renameOutput', () => {
  it('changes the name and keeps the id, program included', () => {
    // Arrange: program and PiP.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: the director prefers "Principal" for program.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'renameOutput', outputId: 'program', name: 'Principal' },
      contextOfTheRundownCommand,
    );

    // Assert: same id, same place, new name.
    expect(outcome.status === 'applied' && outcome.slices.outputs[0], 'renamed').toEqual({
      outputId: 'program',
      name: 'Principal',
      order: 0,
    });
  });

  it('changes nothing for the name it already has', () => {
    // Arrange: program and PiP.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: "PiP" renamed to "PiP".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'renameOutput', outputId: 'pip', name: 'PiP' },
      contextOfTheRundownCommand,
    );

    // Assert: the very same slices, so nothing is saved, logged or sent.
    expect(outcome.status === 'applied' && outcome.slices, 'nothing changed').toBe(slicesBefore);
  });
});

describe('deleteOutput', () => {
  it('removes an output with no layer and closes the gap in the order', () => {
    // Arrange: program, an empty PiP, and "Câmera 2" after it.
    const slicesBefore = {
      ...buildRaceDayWithAnEmptyPip(),
      outputs: [
        buildProgramOutput(),
        buildPipOutput(),
        { outputId: 'camera-2', name: 'Câmera 2', order: 2 },
      ],
    };

    // Act: delete PiP.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteOutput', outputId: 'pip' },
      contextOfTheRundownCommand,
    );

    // Assert: program and Câmera 2, now at 0 and 1.
    expect(outcome.status === 'applied' && outcome.slices.outputs, 'PiP gone, no gap').toEqual([
      buildProgramOutput(),
      { outputId: 'camera-2', name: 'Câmera 2', order: 1 },
    ]);
  });
});

describe('reorderOutputs', () => {
  it('puts the outputs in the order given, numbered from 0', () => {
    // Arrange: program and PiP.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: PiP first.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'reorderOutputs', orderedOutputIds: ['pip', 'program'] },
      contextOfTheRundownCommand,
    );

    // Assert: PiP at 0, program at 1.
    expect(outcome.status === 'applied' && outcome.slices.outputs, 'new order').toEqual([
      { ...buildProgramOutput(), order: 1 },
      { ...buildPipOutput(), order: 0 },
    ]);
  });
});

const outputRefusalScenarios: Array<{
  name: string;
  command: Command;
  code: string;
  message: string;
}> = [
  // Two outputs with one id would share one address: OBS could not tell them apart.
  {
    name: 'createOutput of an id already used',
    command: { type: 'createOutput', outputId: 'pip', name: 'PiP 2' },
    code: 'OUTPUT_ALREADY_EXISTS',
    message:
      'Já existe uma saída com o endereço "pip" ("PiP"). Escolha outro endereço para a nova saída.',
  },
  // A page left open after another operator deleted the output.
  {
    name: 'renameOutput of an output that does not exist',
    command: { type: 'renameOutput', outputId: 'camera-2', name: 'Câmera dois' },
    code: 'OUTPUT_NOT_FOUND',
    message: 'A saída "camera-2" não existe; ela pode ter sido excluída.',
  },
  // The same, for a delete.
  {
    name: 'deleteOutput of an output that does not exist',
    command: { type: 'deleteOutput', outputId: 'camera-2' },
    code: 'OUTPUT_NOT_FOUND',
    message: 'A saída "camera-2" não existe; ela pode ter sido excluída.',
  },
  // Program is what OBS's main source draws; it always exists (João's decision).
  {
    name: 'deleteOutput of program',
    command: { type: 'deleteOutput', outputId: 'program' },
    code: 'PROGRAM_OUTPUT_KEPT',
    message: 'A saída "Programa" não pode ser excluída: ela é a fonte principal do OBS (/render/).',
  },
  // Deleting an output would orphan its layers; the operator deletes or moves them first.
  {
    name: 'deleteOutput of an output that still has layers',
    command: { type: 'deleteOutput', outputId: 'pip' },
    code: 'OUTPUT_HAS_LAYERS',
    message:
      'A saída "PiP" ainda tem 2 camadas: "Moldura", "Legenda". Exclua as camadas ou mude-as de saída antes de excluir a saída.',
  },
  // A list missing an output would leave its order a guess.
  {
    name: 'reorderOutputs without every output',
    command: { type: 'reorderOutputs', orderedOutputIds: ['pip'] },
    code: 'OUTPUTS_NOT_A_PERMUTATION',
    message: 'A nova ordem das saídas precisa trazer cada saída exatamente uma vez.',
  },
  // A list naming one twice is just as unclear.
  {
    name: 'reorderOutputs naming an output twice',
    command: { type: 'reorderOutputs', orderedOutputIds: ['pip', 'pip'] },
    code: 'OUTPUTS_NOT_A_PERMUTATION',
    message: 'A nova ordem das saídas precisa trazer cada saída exatamente uma vez.',
  },
];

describe('the refusals of the output commands', () => {
  it.each(outputRefusalScenarios)('refuses $name', ({ command, code, message }) => {
    // Arrange: program and PiP, with the PiP's frame and caption.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: send the command.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: refused with its code and a pt-BR sentence naming what blocks it.
    expect(outcome, 'the command must be refused, saying why').toEqual({
      status: 'refused',
      error: { code, message },
    });
  });
});
