import type { FieldErrors, ResolverResult } from 'react-hook-form';

import { findItemEditorFormErrors, type ItemEditorFormValues } from './itemEditorForm';

/**
 * The bridge between the item form's rules and react-hook-form: called with the current
 * values whenever the form is checked, it answers either "valid, here are the values" or
 * one message per wrong field, in the shape react-hook-form expects. All the rules
 * themselves are in itemEditorForm.ts; this function only reshapes their result. (It is
 * the same bridge as features/playout/raceClockTakeFormResolver.ts, for the other form.)
 */
export function resolveItemEditorForm(
  formValues: ItemEditorFormValues,
): ResolverResult<ItemEditorFormValues> {
  const messageForEachWrongField = findItemEditorFormErrors(formValues);
  const wrongFieldNames = Object.keys(messageForEachWrongField) as Array<
    keyof ItemEditorFormValues
  >;
  if (wrongFieldNames.length === 0) {
    return { values: formValues, errors: {} };
  }

  const errors: FieldErrors<ItemEditorFormValues> = {};
  for (const fieldName of wrongFieldNames) {
    errors[fieldName] = { type: 'validation', message: messageForEachWrongField[fieldName] };
  }
  return { values: {}, errors };
}
