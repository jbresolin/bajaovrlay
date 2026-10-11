/**
 * One field's value, between the two forms it takes: the data a graphic receives (a
 * number of milliseconds, an ISO 8601 text, true) and what the field's control holds
 * while the operator edits ("12:34", "2026-10-10T09:45", true).
 *
 * Both directions are here so they cannot drift apart: what one writes the other reads.
 * Neither checks the manifest's limits (minimum, maximum, lengths); that is
 * zodSchemaFromDataSchema.ts. They only answer "can this be shown?" and "is this a
 * number / a time / a date at all?".
 */
import {
  convertIsoTextToLocalDateAndTimeText,
  convertLocalDateAndTimeTextToIsoText,
} from './localDateAndTimeText';
import {
  convertMinutesAndSecondsToMilliseconds,
  formatMillisecondsAsMinutesAndSeconds,
} from './minutesAndSeconds';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormFieldValue } from './schemaFormValues';

/** What showing a data value in a control gives: what the control holds, or "cannot". */
export type FormValueShownForDataValue =
  { status: 'shown'; formValue: string | boolean } | { status: 'cannotBeShown' };

/** Why a typed text could not be read as data. */
export type ProblemReadingFormValue = 'notANumber' | 'notMinutesAndSeconds' | 'notADateAndTime';

/** What reading a control's value gives: nothing typed, a data value, or why not. */
export type DataValueReadFromFormValue =
  | { status: 'blank' }
  | { status: 'value'; value: string | number | boolean }
  | { status: 'unreadable'; problem: ProblemReadingFormValue };

// A plain decimal number, as a number input hands it over, with a comma also accepted
// because that is how a decimal is typed in Brazil. No exponent ("1e3"), no "0x10".
const plainNumberPattern = /^-?\d+([.,]\d+)?$/;

// The longest time an mm:ss field can hold: three digits of minutes (see minutesAndSeconds.ts).
const longestDurationShownInMilliseconds = (999 * 60 + 59) * 1_000 + 999;

const cannotBeShown: FormValueShownForDataValue = { status: 'cannotBeShown' };

function isNumberTheFieldCanHold(field: SchemaFormFieldDescription, dataValue: unknown): boolean {
  if (typeof dataValue !== 'number' || !Number.isFinite(dataValue)) {
    return false;
  }
  return field.isWholeNumber ? Number.isInteger(dataValue) : true;
}

/**
 * Turns a data value (from the manifest's `default`, from what is on air, or from a
 * stored item) into what the field's control holds. Answers "cannot be shown" when the
 * value is not of the kind the control edits: a text where a number belongs, an option
 * the dropdown does not have, a time past 999:59. The caller decides what to show
 * instead. An unsupported field can never be shown.
 * What could go wrong: an mm:ss field shows whole seconds, so 90 500 ms shows as "1:30".
 */
export function convertDataValueIntoFormValue(
  field: SchemaFormFieldDescription,
  dataValue: unknown,
): FormValueShownForDataValue {
  switch (field.control) {
    case 'text':
      return typeof dataValue === 'string'
        ? { status: 'shown', formValue: dataValue }
        : cannotBeShown;
    case 'select': {
      const isOneOfTheOptions = field.selectOptions.some((option) => option.value === dataValue);
      return typeof dataValue === 'string' && isOneOfTheOptions
        ? { status: 'shown', formValue: dataValue }
        : cannotBeShown;
    }
    case 'dateTime': {
      const localText =
        typeof dataValue === 'string' ? convertIsoTextToLocalDateAndTimeText(dataValue) : undefined;
      return localText === undefined ? cannotBeShown : { status: 'shown', formValue: localText };
    }
    case 'number':
      return isNumberTheFieldCanHold(field, dataValue)
        ? { status: 'shown', formValue: String(dataValue) }
        : cannotBeShown;
    case 'duration': {
      if (typeof dataValue !== 'number' || !isNumberTheFieldCanHold(field, dataValue)) {
        return cannotBeShown;
      }
      const fitsInMinutesAndSeconds =
        dataValue >= 0 && dataValue <= longestDurationShownInMilliseconds;
      return fitsInMinutesAndSeconds
        ? { status: 'shown', formValue: formatMillisecondsAsMinutesAndSeconds(dataValue) }
        : cannotBeShown;
    }
    case 'switch':
      return typeof dataValue === 'boolean'
        ? { status: 'shown', formValue: dataValue }
        : cannotBeShown;
    case 'unsupported':
      return cannotBeShown;
  }
}

/**
 * Turns what a field's control holds into the data value the graphic receives.
 * - Cleared (null), nothing typed, or only spaces: `blank`. Whether a blank is allowed
 *   is the caller's question (checkSchemaFormValues.ts).
 * - Text is sent without the spaces around it.
 * - A number, an mm:ss time or a date typed in a shape that cannot be read: `unreadable`
 *   with the reason, so the form can put a message under that field.
 * An unsupported field is always blank here: its value never comes from a control.
 */
export function readDataValueFromFormValue(
  field: SchemaFormFieldDescription,
  formValue: SchemaFormFieldValue | undefined,
): DataValueReadFromFormValue {
  if (formValue === null || formValue === undefined || field.control === 'unsupported') {
    return { status: 'blank' };
  }
  if (typeof formValue === 'boolean') {
    // Only a switch holds true or false; anywhere else it is not a typed value.
    return field.control === 'switch' ? { status: 'value', value: formValue } : { status: 'blank' };
  }

  const typedText = formValue.trim();
  if (typedText === '' || field.control === 'switch') {
    return { status: 'blank' };
  }
  switch (field.control) {
    case 'text':
    case 'select':
      return { status: 'value', value: typedText };
    case 'number': {
      if (!plainNumberPattern.test(typedText)) {
        return { status: 'unreadable', problem: 'notANumber' };
      }
      return { status: 'value', value: Number(typedText.replace(',', '.')) };
    }
    case 'duration': {
      const milliseconds = convertMinutesAndSecondsToMilliseconds(typedText);
      return milliseconds === undefined
        ? { status: 'unreadable', problem: 'notMinutesAndSeconds' }
        : { status: 'value', value: milliseconds };
    }
    case 'dateTime': {
      const isoText = convertLocalDateAndTimeTextToIsoText(typedText);
      return isoText === undefined
        ? { status: 'unreadable', problem: 'notADateAndTime' }
        : { status: 'value', value: isoText };
    }
  }
}
