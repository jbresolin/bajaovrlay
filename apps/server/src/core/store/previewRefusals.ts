// The refusals of "Tomar tudo" (takeAllPreviews) and of a macro's "Prévia" (previewMacro),
// each with its stable code and pt-BR message, beside commandRefusals.ts and the others.
import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { ptBRConsoleErrors } from '../messages/ptBRConsoles.js';

/** The refusal for "Tomar tudo" with no preview instance and no "will be cleared" marker. */
export function refuseTakeAllWithNothingInPreview(): CommandError {
  return { code: 'NOTHING_IN_PREVIEW', message: ptBR.previewErrors.nothingInPreview };
}

/**
 * The refusal for "Tomar tudo" when one layer cannot be taken. It keeps the code of that
 * layer's own refusal (INVALID_GRAPHIC_DATA, LAYER_NOT_FOUND, ...), so a client reacts to
 * the real reason, and the message names the layer and says nothing was taken.
 */
export function refuseTakeAllAtLayer(
  layerName: string,
  reasonOfTheLayer: CommandError,
): CommandError {
  return {
    code: reasonOfTheLayer.code,
    message: ptBR.previewErrors.takeAllRefusedAtLayer(layerName, reasonOfTheLayer.message),
  };
}

/**
 * The refusal for "Tomar tudo" when every layer it would take or clear was just changed by
 * another console, unseen by this one (BAJAOVRLAY-69): the code of those layers, and their
 * sentences one after another, so the operator reads what happened on each.
 */
export function refuseTakeAllOnEveryLayerChangedByAnotherConsole(
  refusalsOfTheLayers: CommandError[],
): CommandError {
  return {
    code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
    message: ptBRConsoleErrors.takeAllRefusedOnEveryLayer(
      refusalsOfTheLayers.map((refusal) => refusal.message),
    ),
  };
}

/**
 * The refusal for a macro's "Prévia" when one step cannot be shown. It keeps the code of
 * that step's own refusal (ITEM_NOT_FOUND, LAYER_NOT_FOUND, ...), and the message names
 * the step by its position (counted from 1, as the macro editor lists the steps) and by
 * what it does.
 */
export function refusePreviewMacroAtStep(refusedStep: {
  macroLabel: string;
  stepPosition: number;
  stepDescription: string;
  reasonOfTheStep: CommandError;
}): CommandError {
  return {
    code: refusedStep.reasonOfTheStep.code,
    message: ptBR.previewErrors.previewMacroRefusedAtStep(
      refusedStep.macroLabel,
      refusedStep.stepPosition,
      refusedStep.stepDescription,
      refusedStep.reasonOfTheStep.message,
    ),
  };
}

/** The refusal for a macro's "Prévia" while a macro (any, this one included) is running. */
export function refusePreviewMacroWhileAMacroRuns(
  macroLabel: string,
  runningMacroLabel: string,
): CommandError {
  return {
    code: 'MACRO_RUNNING',
    message: ptBR.previewErrors.previewMacroWhileAMacroRuns(macroLabel, runningMacroLabel),
  };
}
