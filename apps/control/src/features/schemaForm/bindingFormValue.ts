/**
 * A binding between what the form holds (SchemaFormBindingValue: plain texts) and what an
 * item stores (BindingFieldValue): an empty one for a new field, one filled from a stored
 * binding, and the binding read back when the form is checked, with a pt-BR message naming
 * the field when it cannot be saved. The rules are the shared ones the server runs at the
 * save (findProblemInBindingForDataSchemaField), so the editor never sends what the server
 * would refuse for a reason the editor could have said.
 */
import {
  type BindingFieldValue,
  findProblemInBindingForDataSchemaField,
  wholeClockBindingPath,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { buildBindingPathKey, readBindingPathKey } from './bindingChoices';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormBindingValue } from './schemaFormValues';

/** What a field's "Fonte" holds before anything is chosen: live, nothing else. */
export const emptySchemaFormBindingValue: SchemaFormBindingValue = {
  sourceId: '',
  pathKey: '',
  carNumberText: '',
  isLive: true,
  transformId: '',
  transformParameterText: '',
};

/**
 * The one parameter each binding transform that takes one reads, by transform id, and
 * whether it is a whole number typed as digits (the other, formatGapAsText's unit, is a
 * choice). Each binding transform takes at most one parameter, which keeps the form to a
 * single control for it.
 */
export const parameterOfEachBindingTransform: Record<
  string,
  { parameterName: string; isWholeNumber: boolean }
> = {
  topN: { parameterName: 'n', isWholeNumber: true },
  shortenSchoolName: { parameterName: 'maxLength', isWholeNumber: true },
  formatGapAsText: { parameterName: 'unit', isWholeNumber: false },
};

/** The form's value for a stored binding (the whole clock's path is implied, so left blank). */
export function buildSchemaFormBindingValueFromBinding(
  binding: BindingFieldValue,
): SchemaFormBindingValue {
  const parameter =
    binding.transformId === undefined
      ? undefined
      : parameterOfEachBindingTransform[binding.transformId];
  const storedParameters = binding.transformParameters;
  const storedParameter =
    parameter !== undefined && typeof storedParameters === 'object' && storedParameters !== null
      ? (storedParameters as Record<string, unknown>)[parameter.parameterName]
      : undefined;
  return {
    sourceId: binding.sourceId,
    pathKey:
      binding.path === wholeClockBindingPath
        ? ''
        : buildBindingPathKey(binding.shapeKey, binding.path),
    carNumberText: binding.carNumber === undefined ? '' : String(binding.carNumber),
    isLive: binding.isLive,
    transformId: binding.transformId ?? '',
    transformParameterText: storedParameter === undefined ? '' : String(storedParameter),
  };
}

/** What reading a field's "Fonte" out of the form gives: the binding, or why not. */
export type BindingReadFromSchemaForm =
  { status: 'binding'; binding: BindingFieldValue } | { status: 'problem'; message: string };

const formErrors = ptBR.bindings.formErrors;
const wholeNumberFromOnePattern = /^[1-9]\d*$/;

/**
 * Reads the binding a field's choices make, checked as the server will check it:
 * a source and something to read are chosen, a car chosen by number has its number, and
 * the shared rules pass (the path, the transform and its parameter, the field's type).
 * `isWholeClock` is true for "Relógio da fonte", which reads the session clock whole.
 */
export function readBindingFromSchemaFormValue(
  field: SchemaFormFieldDescription,
  bindingValue: SchemaFormBindingValue,
  dataSchema: unknown,
  isWholeClock: boolean,
): BindingReadFromSchemaForm {
  if (bindingValue.sourceId === '') {
    return { status: 'problem', message: formErrors.sourceMissing(field.label) };
  }
  const shapeAndPath = isWholeClock
    ? { shapeKey: 'session' as const, path: wholeClockBindingPath }
    : readBindingPathKey(bindingValue.pathKey);
  if (shapeAndPath === undefined) {
    return { status: 'problem', message: formErrors.pathMissing(field.label) };
  }

  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: bindingValue.sourceId,
    shapeKey: shapeAndPath.shapeKey,
    path: shapeAndPath.path,
    isLive: bindingValue.isLive,
  };
  const isCarChosenByNumber = shapeAndPath.path.startsWith('entryOfCar.');
  if (isCarChosenByNumber) {
    const carNumberText = bindingValue.carNumberText.trim();
    if (!wholeNumberFromOnePattern.test(carNumberText)) {
      return { status: 'problem', message: formErrors.carNumberInvalid(field.label) };
    }
    binding.carNumber = Number(carNumberText);
  }
  if (!isWholeClock && bindingValue.transformId !== '') {
    binding.transformId = bindingValue.transformId;
    const parameter = parameterOfEachBindingTransform[bindingValue.transformId];
    if (parameter !== undefined) {
      binding.transformParameters = {
        [parameter.parameterName]: readParameterText(
          bindingValue.transformParameterText,
          parameter,
        ),
      };
    }
  }

  const problem = findProblemInBindingForDataSchemaField(binding, dataSchema, field.key);
  if (problem !== undefined) {
    return { status: 'problem', message: formErrors.aboutField(field.label, problem) };
  }
  return { status: 'binding', binding };
}

/**
 * The parameter typed, as the transform reads it: digits as a number for a whole-number
 * parameter, the text itself otherwise (and for digits mistyped, which the shared check
 * then refuses with its own sentence).
 */
function readParameterText(
  parameterText: string,
  parameter: { isWholeNumber: boolean },
): string | number {
  const trimmedText = parameterText.trim();
  if (parameter.isWholeNumber && /^\d+$/.test(trimmedText)) {
    return Number(trimmedText);
  }
  return trimmedText;
}
