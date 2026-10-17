import { isDeepStrictEqual } from 'node:util';

import type { MacroStep, PreviewMacroCommand } from '@bajaovrlay/shared';

import { ptBR } from '../../messages/ptBR.js';
import { refusePreviewMacroAtStep, refusePreviewMacroWhileAMacroRuns } from '../previewRefusals.js';
import { refuseUnknownMacro } from '../quickFireAndMacroRefusals.js';
import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import { buildContextForInstanceOnLayer } from './instanceIdForEachLayer.js';
import { reducePreviewClearLayer } from './previewClearLayer.js';
import {
  discardEveryPreviewAndMarker,
  removeEveryPreviewInstance,
} from './previewMarkersAndDiscards.js';
import { putItemOnOutput } from './putItemOnOutput.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * previewMacro (a macro's "Prévia"): shows on the preview output the screen as it will be
 * when the macro has ended. Two behaviours sit side by side and never mix:
 * - "Prévia" (this reducer) shows the macro's END STATE at once, and "Tomar tudo"
 *   (takeAllPreviews) then applies it in one cut, WITHOUT the waits;
 * - "Executar" (runMacro, runMacro.ts) plays the macro on program WITH its timing, and
 *   starting a run discards every preview and marker first.
 *
 * First every preview instance and "will be cleared" marker is thrown away; then each
 * step is played onto the preview state only, in order:
 * - takeItem previews the item on its layer through putItemOnOutput, the path previewItem
 *   uses (resolved as a take, marked `manual` because the operator asked for this
 *   preview), replacing any preview or marker on that layer;
 * - clearLayer marks the layer "will be cleared", throwing away its preview, through the
 *   previewClearLayer reducer;
 * - clearAll throws away every preview and marks exactly the layers that have something
 *   on program now, in the order of the layers (a layer empty on program needs no
 *   marker, so the marker of an earlier clearLayer on such a layer goes too);
 * - wait is skipped.
 * Program, the rundowns and the items are never touched. Each preview the macro makes
 * gets the store's new instance id followed by its layer id (instanceIdForEachLayer.ts).
 *
 * Refused, with nothing changed, if the macro does not exist, while any macro is running
 * (MACRO_RUNNING: the run's steps would change Prévia under the operator's eyes), or when
 * any step would be refused (an item that no longer exists, a layer that does not exist,
 * data its graphic refuses): the message names the step by position and by what it does.
 */
export function reducePreviewMacro(
  slices: SlicesChangedByCommands,
  command: PreviewMacroCommand,
  context: ReducerContext,
): ReducerOutcome {
  const macro = slices.macros.find((candidate) => candidate.id === command.macroId);
  if (macro === undefined) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const runInProgress = slices.macroRuns[0];
  if (runInProgress !== undefined) {
    const runningMacro = slices.macros.find((candidate) => candidate.id === runInProgress.macroId);
    const runningMacroLabel = runningMacro?.label ?? runInProgress.macroId;
    return {
      status: 'refused',
      error: refusePreviewMacroWhileAMacroRuns(macro.label, runningMacroLabel),
    };
  }

  let slicesSoFar = discardEveryPreviewAndMarker(slices);
  for (const [stepIndex, step] of macro.steps.entries()) {
    const stepOutcome = previewOneMacroStep(slicesSoFar, step, context);
    if (stepOutcome.status === 'refused') {
      const refusal = refusePreviewMacroAtStep({
        macroLabel: macro.label,
        stepPosition: stepIndex + 1,
        stepDescription: describeMacroStep(slices, step),
        reasonOfTheStep: stepOutcome.error,
      });
      return { status: 'refused', error: refusal };
    }
    slicesSoFar = stepOutcome.slices;
  }
  return { status: 'applied', slices: slicesSoFar };
}

/** Plays one macro step onto the preview state only; see reducePreviewMacro. */
function previewOneMacroStep(
  slices: SlicesChangedByCommands,
  step: MacroStep,
  context: ReducerContext,
): ReducerOutcome {
  switch (step.kind) {
    case 'takeItem': {
      const item = slices.items.find((candidate) => candidate.id === step.itemId);
      if (item === undefined) {
        return { status: 'refused', error: refuseUnknownItem(step.itemId) };
      }
      const contextOfTheItemsLayer = buildContextForInstanceOnLayer(context, item.layerId);
      const previewOutcome = putItemOnOutput(slices, item.id, 'preview', contextOfTheItemsLayer);
      if (previewOutcome.status === 'refused') {
        return previewOutcome;
      }
      return { status: 'applied', slices: previewOutcome.slices };
    }
    case 'clearLayer':
      return reducePreviewClearLayer(slices, { type: 'previewClearLayer', layerId: step.layerId });
    case 'clearAll':
      return { status: 'applied', slices: previewClearAll(slices) };
    case 'wait':
      // A wait puts nothing on screen: the end state is the same with or without it.
      return { status: 'applied', slices };
  }
}

/**
 * clearAll played onto the preview state: no preview, and a marker on exactly the layers
 * that have something on program, in the order of the layers. The same arrays come back
 * for what does not change.
 */
function previewClearAll(slices: SlicesChangedByCommands): SlicesChangedByCommands {
  const layerIdsWithSomethingOnProgram = slices.layers
    .filter((layer) =>
      slices.instances.some(
        (instance) => instance.layerId === layer.id && instance.target === 'program',
      ),
    )
    .map((layer) => layer.id);
  const isMarkersUnchanged = isDeepStrictEqual(
    layerIdsWithSomethingOnProgram,
    slices.previewClearedLayerIds,
  );
  return {
    ...slices,
    instances: removeEveryPreviewInstance(slices.instances),
    previewClearedLayerIds: isMarkersUnchanged
      ? slices.previewClearedLayerIds
      : layerIdsWithSomethingOnProgram,
  };
}

/**
 * One macro step in pt-BR words, for a refusal: the item by its label and the layer by
 * its name when the server has them, by id when not (which is usually why it failed).
 */
function describeMacroStep(slices: SlicesChangedByCommands, step: MacroStep): string {
  switch (step.kind) {
    case 'takeItem': {
      const item = slices.items.find((candidate) => candidate.id === step.itemId);
      return ptBR.macroStepDescriptions.takeItem(item?.label ?? step.itemId);
    }
    case 'clearLayer': {
      const layer = slices.layers.find((candidate) => candidate.id === step.layerId);
      return ptBR.macroStepDescriptions.clearLayer(layer?.name ?? step.layerId);
    }
    case 'clearAll':
      return ptBR.macroStepDescriptions.clearAll;
    case 'wait':
      return ptBR.macroStepDescriptions.wait(step.ms);
  }
}
