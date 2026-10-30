// The refusals of the output and layer commands, each with its stable code and pt-BR
// message (core/messages/ptBROutputs.ts), beside the module's reducers.
import type { CommandError, Layer, Output } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/** The refusal for a command naming an output that does not exist. */
export function refuseUnknownOutput(outputId: string): CommandError {
  return { code: 'OUTPUT_NOT_FOUND', message: ptBR.outputs.outputNotFound(outputId) };
}

/** The refusal for createOutput with an id another output has. */
export function refuseOutputAlreadyThere(existingOutput: Output): CommandError {
  return {
    code: 'OUTPUT_ALREADY_EXISTS',
    message: ptBR.outputs.outputAlreadyExists(existingOutput.outputId, existingOutput.name),
  };
}

/** The refusal for deleting program. */
export function refuseDeleteOfProgram(program: Output): CommandError {
  return { code: 'PROGRAM_OUTPUT_KEPT', message: ptBR.outputs.programOutputKept(program.name) };
}

/** The refusal for deleting an output that still has layers, naming them bottom to top. */
export function refuseDeleteOfOutputWithLayers(output: Output, layers: Layer[]): CommandError {
  return {
    code: 'OUTPUT_HAS_LAYERS',
    message: ptBR.outputs.outputHasLayers(
      output.name,
      layers.map((layer) => layer.name),
    ),
  };
}

/** The refusal for a reorderOutputs list that is not every output once. */
export function refuseOutputsNotAPermutation(): CommandError {
  return { code: 'OUTPUTS_NOT_A_PERMUTATION', message: ptBR.outputs.outputsNotAPermutation };
}

/** The refusal for createLayer with an id another layer has. */
export function refuseLayerAlreadyThere(existingLayer: Layer): CommandError {
  return {
    code: 'LAYER_ALREADY_EXISTS',
    message: ptBR.outputs.layerAlreadyExists(existingLayer.id, existingLayer.name),
  };
}

/** The refusal for putting a layer at the height another layer of that output has. */
export function refuseHeightTaken(
  zIndex: number,
  output: Output,
  layerAtThatHeight: Layer,
  layerName: string,
): CommandError {
  return {
    code: 'LAYER_ZINDEX_TAKEN',
    message: ptBR.outputs.zIndexTaken(zIndex, output.name, layerAtThatHeight.name, layerName),
  };
}

/**
 * The refusal for deleting the fullscreen layer or moving it off program: every graphic
 * without a usable default layer goes there, so it must exist and be program's.
 */
export function refuseChangeOfTheFallbackLayer(
  fallbackLayer: Layer,
  program: Output | undefined,
): CommandError {
  return {
    code: 'FALLBACK_LAYER_KEPT',
    message: ptBR.outputs.fallbackLayerKept(
      fallbackLayer.name,
      program?.name ?? ptBR.outputs.programOutputName,
    ),
  };
}

/** The refusal for a reorderLayers list that is not every layer of the output once. */
export function refuseLayersNotAPermutation(output: Output): CommandError {
  return {
    code: 'LAYERS_NOT_A_PERMUTATION',
    message: ptBR.outputs.layersNotAPermutation(output.name),
  };
}

/**
 * The refusal for deleting or moving a layer with something on it; `whatIsOnIt` holds
 * the sentences of ptBR.outputs.thingsOnALayer that apply.
 */
export function refuseLayerNotEmpty(
  layer: Layer,
  action: 'delete' | 'move',
  whatIsOnIt: string[],
): CommandError {
  return {
    code: 'LAYER_NOT_EMPTY',
    message: ptBR.outputs.layerNotEmpty(layer.name, ptBR.outputs.layerActions[action], whatIsOnIt),
  };
}

/** The refusal for deleting a layer something names; `usesOfEachKind` as layerUses.ts writes. */
export function refuseLayerInUse(layer: Layer, usesOfEachKind: string[]): CommandError {
  return { code: 'LAYER_IN_USE', message: ptBR.outputs.layerInUse(layer.name, usesOfEachKind) };
}
