import { type BindableValueType, findBindablePath } from '../dataShapes/bindablePaths.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { checkTransformParameters } from '../transforms/checkTransformParameters.js';
import type { BindingFieldValue } from './bindingFieldValue.js';
import { ptBRBindings } from './ptBRBindings.js';

/**
 * Says what is wrong with a binding whose shape already passed BindingFieldValueSchema,
 * as one pt-BR sentence, or undefined when its parts make sense together: the path is
 * one the picker lists for the shape, a car chosen by number has its number and no
 * other path carries one, and a transform exists with good parameters. Pure, so the
 * server (at save time) and the item editor (before sending) judge alike.
 */
export function findProblemInBinding(binding: BindingFieldValue): string | undefined {
  const bindablePath = findBindablePath(binding.shapeKey, binding.path);
  if (bindablePath === undefined) {
    const shapeName = ptBRDataShapes.shapeNames[binding.shapeKey];
    return ptBRBindings.bindingProblems.pathNotOffered(binding.path, shapeName);
  }

  // A car path with no number would follow no car; a number on a place path would be
  // ignored while the operator believes the field follows that car.
  const hasCarNumber = binding.carNumber !== undefined;
  if (bindablePath.isCarChosenByNumber && !hasCarNumber) {
    return ptBRBindings.bindingProblems.carNumberMissing;
  }
  if (!bindablePath.isCarChosenByNumber && hasCarNumber) {
    return ptBRBindings.bindingProblems.carNumberOnFixedPlace(
      ptBRDataShapes.carChosenByNumberLabel,
    );
  }

  return findProblemInTransformOfBinding(binding);
}

/**
 * The type of value the binding reads, or undefined when its path is not listed. This
 * is what decides which graphic fields it may fill (bindingFitsGraphicField.ts).
 */
export function findValueTypeOfBinding(binding: BindingFieldValue): BindableValueType | undefined {
  return findBindablePath(binding.shapeKey, binding.path)?.valueType;
}

/** The transform's problem: parameters with no transform, or the registry's own check. */
function findProblemInTransformOfBinding(binding: BindingFieldValue): string | undefined {
  if (binding.transformId === undefined) {
    if (binding.transformParameters !== undefined) {
      return ptBRBindings.bindingProblems.parametersWithoutTransform;
    }
    return undefined;
  }
  const parametersCheck = checkTransformParameters(
    binding.transformId,
    binding.transformParameters,
  );
  return parametersCheck.ok ? undefined : parametersCheck.reason;
}
