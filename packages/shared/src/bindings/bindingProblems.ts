import { type BindableValueType, findBindablePath } from '../dataShapes/bindablePaths.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { checkTransformParameters } from '../transforms/checkTransformParameters.js';
import { findTransform } from '../transforms/transformRegistry.js';
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

  return findProblemInTransformOfBinding(binding, bindablePath.valueType, bindablePath.label);
}

/**
 * The type of value the binding gives its field: its path's type, or what its transform
 * makes of it (a lap in ms written as text is text; topN gives back the list it read).
 * Undefined when its path is not listed or its transform is not a binding transform. This
 * is what decides which graphic fields it may fill (bindingFitsGraphicField.ts).
 */
export function findValueTypeOfBinding(binding: BindingFieldValue): BindableValueType | undefined {
  const valueTypeOfThePath = findBindablePath(binding.shapeKey, binding.path)?.valueType;
  if (valueTypeOfThePath === undefined || binding.transformId === undefined) {
    return valueTypeOfThePath;
  }
  const transform = findTransform(binding.transformId);
  if (transform?.family !== 'binding') {
    return undefined;
  }
  return transform.valueTypeGiven === 'sameAsTheValueRead'
    ? valueTypeOfThePath
    : transform.valueTypeGiven;
}

/**
 * The transform's problem: parameters with no transform, the registry's own check (an
 * unknown id, a mapping transform, bad parameters), or a transform that cannot read the
 * type found at the path, which would be refused on air at every refresh.
 */
function findProblemInTransformOfBinding(
  binding: BindingFieldValue,
  valueTypeOfThePath: BindableValueType,
  labelOfThePath: string,
): string | undefined {
  if (binding.transformId === undefined) {
    if (binding.transformParameters !== undefined) {
      return ptBRBindings.bindingProblems.parametersWithoutTransform;
    }
    return undefined;
  }
  const parametersCheck = checkTransformParameters(
    binding.transformId,
    binding.transformParameters,
    'binding',
  );
  if (!parametersCheck.ok) {
    return parametersCheck.reason;
  }
  const transform = findTransform(binding.transformId);
  const canReadThePath =
    transform?.family === 'binding' && transform.valueTypesRead.includes(valueTypeOfThePath);
  if (!canReadThePath) {
    const transformLabel = transform?.label ?? binding.transformId;
    return ptBRBindings.bindingProblems.transformDoesNotReadPath(transformLabel, labelOfThePath);
  }
  return undefined;
}
