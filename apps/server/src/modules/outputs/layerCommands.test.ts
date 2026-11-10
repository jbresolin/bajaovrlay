/**
 * The layer commands: createLayer, updateLayer, moveLayerToOutput, reorderLayers
 * (apps/server)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-49 the operator edits the layers on "Saídas e camadas" instead of
 *   living with a fixed seed: rehearsals keep finding "we need one more slot here". A
 *   layer belongs to one output, and its zIndex is unique within that output. The slice
 *   stays sorted bottom to top after every edit, as the seed always was.
 *
 * What these tests prove (on the pure reducer, through reduceCommand):
 *   - createLayer adds the layer to its output, in its z-order place, with the page's id.
 *   - updateLayer changes only what it carries, even with a graphic on air on the layer,
 *     and the same values change nothing.
 *   - moveLayerToOutput moves an empty layer, keeping its id, name and height.
 *   - reorderLayers hands the output's own heights out again in the dragged order, so the
 *     gaps stay; the other output is untouched.
 *   - Each refusal, one row per guard: an id already used, a height already used in that
 *     output (named), an output or layer that does not exist, a move while something is
 *     on the layer (on air, in preview, marked "vai limpar"), a move to a height the other
 *     output uses, a move of the fullscreen layer off program (the fallback of every
 *     graphic stays on program, gate 2 of PR #32), a reorder list that is not every layer of
 *     the output once.
 *
 * What these tests deliberately do not cover:
 *   - deleteLayer; deleteLayer.test.ts.
 *   - The renderer redrawing its containers; apps/renderer does.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from '../../core/store/reducers/reduceCommand.js';
import { contextOfTheRundownCommand } from '../../core/store/reducers/rundownSlices.testSupport.js';
import {
  buildPipCaptionOnAir,
  buildRaceDaySlicesWithPip,
  readLayerIdsWithTheirOutput,
} from './outputSlices.testSupport.js';

describe('createLayer', () => {
  it('adds the layer to its output in its z-order place', () => {
    // Arrange: program and PiP, the PiP with its frame (10) and caption (20).
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: João adds "Placar" to the PiP, between the frame and the caption.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'createLayer',
        layerId: 'placar-pip',
        outputId: 'pip',
        name: 'Placar',
        zIndex: 15,
        replacePolicy: 'crossfade',
        persistent: false,
      },
      contextOfTheRundownCommand,
    );

    // Assert: the new layer sits between 10 and 20, exactly as sent.
    const layersAfter = outcome.status === 'applied' ? outcome.slices.layers : [];
    expect(readLayerIdsWithTheirOutput(layersAfter), 'in its place, bottom to top').toEqual([
      'bug@program:10',
      'moldura-pip@pip:10',
      'channel-logo@program:15',
      'placar-pip@pip:15',
      'bracket-match@program:17',
      'ticker@program:20',
      'legenda-pip@pip:20',
      'clock@program:30',
      'tower@program:35',
      'lower-third@program:40',
      'notice@program:45',
      'fullscreen@program:50',
    ]);
    expect(
      layersAfter.find((layer) => layer.id === 'placar-pip'),
      'the layer is stored as the page sent it',
    ).toEqual({
      id: 'placar-pip',
      outputId: 'pip',
      name: 'Placar',
      zIndex: 15,
      replacePolicy: 'crossfade',
      persistent: false,
    });
  });
});

describe('updateLayer', () => {
  it('changes only what it carries, with a graphic on air on the layer', () => {
    // Arrange: the PiP's caption on air.
    const slicesBefore = buildRaceDaySlicesWithPip({ instances: [buildPipCaptionOnAir()] });

    // Act: rename the caption and lift it to 25.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'updateLayer', layerId: 'legenda-pip', name: 'Legenda ao vivo', zIndex: 25 },
      contextOfTheRundownCommand,
    );

    // Assert: new name and height, the rest as it was, the graphic still on air.
    const layersAfter = outcome.status === 'applied' ? outcome.slices.layers : [];
    expect(
      layersAfter.find((layer) => layer.id === 'legenda-pip'),
      'renamed and lifted, the rest kept',
    ).toEqual({
      id: 'legenda-pip',
      outputId: 'pip',
      name: 'Legenda ao vivo',
      zIndex: 25,
      replacePolicy: 'out-then-in',
      persistent: false,
    });
    expect(
      outcome.status === 'applied' && outcome.slices.instances,
      'an edit of the layer leaves what is on air alone',
    ).toBe(slicesBefore.instances);
  });

  it('changes nothing when every value is the one the layer has', () => {
    // Arrange: program and PiP.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: save the caption with its own values.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'updateLayer', layerId: 'legenda-pip', name: 'Legenda', zIndex: 20 },
      contextOfTheRundownCommand,
    );

    // Assert: the very same slices, so nothing is saved, logged or sent.
    expect(outcome.status === 'applied' && outcome.slices, 'nothing changed').toBe(slicesBefore);
  });
});

describe('moveLayerToOutput', () => {
  it('moves an empty layer to the other output, keeping its id, name and height', () => {
    // Arrange: program and PiP, nothing on air.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: move the program's tower (35) to the PiP, which has no layer at 35.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'moveLayerToOutput', layerId: 'tower', outputId: 'pip' },
      contextOfTheRundownCommand,
    );

    // Assert: the tower is now the PiP's, at 35, with its name.
    expect(
      outcome.status === 'applied' && outcome.slices.layers.find((layer) => layer.id === 'tower'),
      'the tower belongs to the PiP now',
    ).toEqual({
      id: 'tower',
      outputId: 'pip',
      name: 'Torre',
      zIndex: 35,
      replacePolicy: 'out-then-in',
      persistent: true,
    });
  });
});

describe('reorderLayers', () => {
  it("hands the output's own heights out again in the dragged order", () => {
    // Arrange: program and PiP, the PiP's frame at 10 and caption at 20.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: drag the caption under the frame.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'reorderLayers', outputId: 'pip', orderedLayerIds: ['legenda-pip', 'moldura-pip'] },
      contextOfTheRundownCommand,
    );

    // Assert: the caption takes 10, the frame 20; program's layers keep theirs.
    const layersAfter = outcome.status === 'applied' ? outcome.slices.layers : [];
    expect(
      readLayerIdsWithTheirOutput(layersAfter).filter((entry) => entry.includes('@pip')),
      "the PiP's heights, handed out in the new order",
    ).toEqual(['legenda-pip@pip:10', 'moldura-pip@pip:20']);
    expect(
      layersAfter.filter((layer) => layer.outputId === 'program'),
      'the program layers are untouched',
    ).toEqual(slicesBefore.layers.filter((layer) => layer.outputId === 'program'));
  });

  it('changes nothing when the order is the one the output has', () => {
    // Arrange: program and PiP.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: a drag dropped where it started.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'reorderLayers', outputId: 'pip', orderedLayerIds: ['moldura-pip', 'legenda-pip'] },
      contextOfTheRundownCommand,
    );

    // Assert: the very same slices.
    expect(outcome.status === 'applied' && outcome.slices, 'nothing changed').toBe(slicesBefore);
  });
});

const layerRefusalScenarios: Array<{
  name: string;
  slicesParts?: Parameters<typeof buildRaceDaySlicesWithPip>[0];
  command: Command;
  code: string;
  message: string;
}> = [
  // Two layers with one id: an item naming it could land on either.
  {
    name: 'createLayer of an id already used',
    command: {
      type: 'createLayer',
      layerId: 'moldura-pip',
      outputId: 'pip',
      name: 'Moldura nova',
      zIndex: 5,
      replacePolicy: 'cut',
      persistent: true,
    },
    code: 'LAYER_ALREADY_EXISTS',
    message: 'Já existe uma camada com o id "moldura-pip" ("Moldura").',
  },
  // Two layers at one height of one output: which draws on top would be a guess.
  {
    name: 'createLayer at a height the output already uses',
    command: {
      type: 'createLayer',
      layerId: 'placar-pip',
      outputId: 'pip',
      name: 'Placar',
      zIndex: 20,
      replacePolicy: 'cut',
      persistent: false,
    },
    code: 'LAYER_ZINDEX_TAKEN',
    message:
      'A posição 20 da saída "PiP" já é da camada "Legenda". Escolha outra posição para "Placar".',
  },
  // The page offered an output another operator deleted meanwhile.
  {
    name: 'createLayer on an output that does not exist',
    command: {
      type: 'createLayer',
      layerId: 'placar-camera-2',
      outputId: 'camera-2',
      name: 'Placar',
      zIndex: 10,
      replacePolicy: 'cut',
      persistent: false,
    },
    code: 'OUTPUT_NOT_FOUND',
    message: 'A saída "camera-2" não existe; ela pode ter sido excluída.',
  },
  // Lifting a layer onto another's height of the same output.
  {
    name: 'updateLayer to a height the output already uses',
    command: { type: 'updateLayer', layerId: 'moldura-pip', zIndex: 20 },
    code: 'LAYER_ZINDEX_TAKEN',
    message:
      'A posição 20 da saída "PiP" já é da camada "Legenda". Escolha outra posição para "Moldura".',
  },
  // A page left open after the layer was deleted.
  {
    name: 'updateLayer of a layer that does not exist',
    command: { type: 'updateLayer', layerId: 'placar-pip', name: 'Placar' },
    code: 'LAYER_NOT_FOUND',
    message: 'A camada "placar-pip" não existe.',
  },
  // Moving what is on air would make it jump from one OBS source to another.
  {
    name: 'moveLayerToOutput of a layer with a graphic on air',
    slicesParts: { instances: [buildPipCaptionOnAir()] },
    command: { type: 'moveLayerToOutput', layerId: 'legenda-pip', outputId: 'program' },
    code: 'LAYER_NOT_EMPTY',
    message:
      'A camada "Legenda" não pode mudar de saída: tem um gráfico no ar. Limpe a camada antes.',
  },
  // The same for a preview: Prévia would show it on the wrong output.
  {
    name: 'moveLayerToOutput of a layer with a graphic in preview',
    slicesParts: { instances: [{ ...buildPipCaptionOnAir(), target: 'preview' }] },
    command: { type: 'moveLayerToOutput', layerId: 'legenda-pip', outputId: 'program' },
    code: 'LAYER_NOT_EMPTY',
    message:
      'A camada "Legenda" não pode mudar de saída: tem um gráfico em prévia. Limpe a camada antes.',
  },
  // A "vai limpar" mark is a promise about this output's next take.
  {
    name: 'moveLayerToOutput of a layer marked "vai limpar"',
    slicesParts: { previewClearedLayerIds: ['legenda-pip'] },
    command: { type: 'moveLayerToOutput', layerId: 'legenda-pip', outputId: 'program' },
    code: 'LAYER_NOT_EMPTY',
    message:
      'A camada "Legenda" não pode mudar de saída: está marcada "vai limpar" na Prévia. Limpe a camada antes.',
  },
  // The other output has a layer at that height already: program's ticker is at 20.
  {
    name: 'moveLayerToOutput to a height the other output uses',
    command: { type: 'moveLayerToOutput', layerId: 'legenda-pip', outputId: 'program' },
    code: 'LAYER_ZINDEX_TAKEN',
    message:
      'A posição 20 da saída "Programa" já é da camada "Letreiro". Escolha outra posição para "Legenda".',
  },
  // The fullscreen layer is where a graphic without a usable default goes, on program: on
  // the PiP, such a graphic would land in the wrong OBS scene.
  {
    name: 'moveLayerToOutput of the fullscreen layer off program',
    command: { type: 'moveLayerToOutput', layerId: 'fullscreen', outputId: 'pip' },
    code: 'FALLBACK_LAYER_KEPT',
    message: 'A camada Tela cheia é a camada padrão dos gráficos e fica na saída Programa.',
  },
  // Moving to an output that does not exist.
  {
    name: 'moveLayerToOutput to an output that does not exist',
    command: { type: 'moveLayerToOutput', layerId: 'legenda-pip', outputId: 'camera-2' },
    code: 'OUTPUT_NOT_FOUND',
    message: 'A saída "camera-2" não existe; ela pode ter sido excluída.',
  },
  // A drag of a list missing a layer of the output.
  {
    name: 'reorderLayers without every layer of the output',
    command: { type: 'reorderLayers', outputId: 'pip', orderedLayerIds: ['legenda-pip'] },
    code: 'LAYERS_NOT_A_PERMUTATION',
    message: 'A nova ordem das camadas de "PiP" precisa trazer cada camada dessa saída uma vez.',
  },
  // A drag naming a layer of another output.
  {
    name: 'reorderLayers naming a layer of another output',
    command: {
      type: 'reorderLayers',
      outputId: 'pip',
      orderedLayerIds: ['legenda-pip', 'bug'],
    },
    code: 'LAYERS_NOT_A_PERMUTATION',
    message: 'A nova ordem das camadas de "PiP" precisa trazer cada camada dessa saída uma vez.',
  },
];

describe('the refusals of the layer commands', () => {
  it.each(layerRefusalScenarios)('refuses $name', ({ slicesParts, command, code, message }) => {
    // Arrange: program and PiP, with what the row puts on the PiP's caption.
    const slicesBefore = buildRaceDaySlicesWithPip(slicesParts ?? {});

    // Act: send the command.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: refused with its code and a pt-BR sentence naming what blocks it.
    expect(outcome, 'the command must be refused, saying why').toEqual({
      status: 'refused',
      error: { code, message },
    });
  });
});
