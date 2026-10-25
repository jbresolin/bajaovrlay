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
 * The type of value the binding gives its field: its path's type, or what its transforms
 * make of it, in order (a lap in ms written as text is text; topN and withTeamLogos give
 * back the list they read). Undefined when its path is not listed or a transform is not a
 * binding transform. This is what decides which graphic fields it may fill
 * (bindingFitsGraphicField.ts).
 */
export function findValueTypeOfBinding(binding: BindingFieldValue): BindableValueType | undefined {
  const valueTypeOfThePath = findBindablePath(binding.shapeKey, binding.path)?.valueType;
  if (valueTypeOfThePath === undefined) {
    return undefined;
  }
  const valueTypeAfterTheFirst = findValueTypeGivenByTransform(
    binding.transformId,
    valueTypeOfThePath,
  );
  if (valueTypeAfterTheFirst === undefined) {
    return undefined;
  }
  return findValueTypeGivenByTransform(binding.thenTransformId, valueTypeAfterTheFirst);
}

/**
 * The type a binding transform gives when it reads `valueTypeRead`; the type read itself
 * when there is no transform; undefined for an id that is not a binding transform.
 */
function findValueTypeGivenByTransform(
  transformId: string | undefined,
  valueTypeRead: BindableValueType,
): BindableValueType | undefined {
  if (transformId === undefined) {
    return valueTypeRead;
  }
  const transform = findTransform(transformId);
  if (transform?.family !== 'binding') {
    return undefined;
  }
  return transform.valueTypeGiven === 'sameAsTheValueRead'
    ? valueTypeRead
    : transform.valueTypeGiven;
}

/**
 * The transforms' problem: parameters with no transform, a second transform with no first,
 * the registry's own check of each (an unknown id, a mapping transform, bad parameters),
 * or a transform that cannot read what it is handed (the path's type for the first, what
 * the first gives for the second), which would be refused on air at every refresh.
 */
function findProblemInTransformOfBinding(
  binding: BindingFieldValue,
  valueTypeOfThePath: BindableValueType,
  labelOfThePath: string,
): string | undefined {
  const problems = ptBRBindings.bindingProblems;
  if (binding.transformId === undefined) {
    if (binding.transformParameters !== undefined) {
      return problems.parametersWithoutTransform;
    }
    if (binding.thenTransformId !== undefined) {
      return problems.secondTransformWithoutFirst;
    }
    return undefined;
  }
  const problemOfTheFirst = findProblemInOneTransform(
    binding.transformId,
    binding.transformParameters,
    valueTypeOfThePath,
    () =>
      problems.transformDoesNotReadPath(readTransformLabel(binding.transformId), labelOfThePath),
  );
  if (problemOfTheFirst !== undefined) {
    return problemOfTheFirst;
  }

  if (binding.thenTransformId === undefined) {
    if (binding.thenTransformParameters !== undefined) {
      return problems.secondParametersWithoutSecondTransform;
    }
    return undefined;
  }
  // The first passed its check, so it is a binding transform and gives a type.
  const valueTypeAfterTheFirst =
    findValueTypeGivenByTransform(binding.transformId, valueTypeOfThePath) ?? valueTypeOfThePath;
  return findProblemInOneTransform(
    binding.thenTransformId,
    binding.thenTransformParameters,
    valueTypeAfterTheFirst,
    () =>
      problems.secondTransformDoesNotReadFirst(
        readTransformLabel(binding.thenTransformId),
        readTransformLabel(binding.transformId),
      ),
  );
}

/**
 * One transform's problem: the registry's check of its id and parameters, then whether it
 * reads the type it is handed (`describeTypeMismatch` writes that sentence).
 */
function findProblemInOneTransform(
  transformId: string,
  transformParameters: unknown,
  valueTypeHandedToIt: BindableValueType,
  describeTypeMismatch: () => string,
): string | undefined {
  const parametersCheck = checkTransformParameters(transformId, transformParameters, 'binding');
  if (!parametersCheck.ok) {
    return parametersCheck.reason;
  }
  const transform = findTransform(transformId);
  const canReadTheValue =
    transform?.family === 'binding' && transform.valueTypesRead.includes(valueTypeHandedToIt);
  if (!canReadTheValue) {
    return describeTypeMismatch();
  }
  return undefined;
}

/** A transform's pt-BR label, or its id when the registry does not have it. */
function readTransformLabel(transformId: string | undefined): string {
  if (transformId === undefined) {
    return '';
  }
  return findTransform(transformId)?.label ?? transformId;
}
