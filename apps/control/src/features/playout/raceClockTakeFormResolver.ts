import type { FieldErrors, ResolverResult } from 'react-hook-form';

import { findRaceClockTakeFormErrors, type RaceClockTakeFormValues } from './raceClockTakeForm';

/**
 * The bridge between the form's rules and react-hook-form: called with the current
 * values on every submit, it answers either "valid, here are the values" or one message
 * per wrong field, in the shape react-hook-form expects. All the rules themselves are in
 * raceClockTakeForm.ts; this function only reshapes their result.
 */
export function resolveRaceClockTakeForm(
  formValues: RaceClockTakeFormValues,
): ResolverResult<RaceClockTakeFormValues> {
  const messageForEachWrongField = findRaceClockTakeFormErrors(formValues);
  const wrongFieldNames = Object.keys(messageForEachWrongField) as Array<
    keyof RaceClockTakeFormValues
  >;
  if (wrongFieldNames.length === 0) {
    return { values: formValues, errors: {} };
  }

  const errors: FieldErrors<RaceClockTakeFormValues> = {};
  for (const fieldName of wrongFieldNames) {
    errors[fieldName] = { type: 'validation', message: messageForEachWrongField[fieldName] };
  }
  return { values: {}, errors };
}
