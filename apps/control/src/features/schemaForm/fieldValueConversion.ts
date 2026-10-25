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
import type { SchemaFormFieldValue, SchemaFormTextListLine } from './schemaFormValues';

/** What showing a data value in a control gives: what the control holds, or "cannot". */
export type FormValueShownForDataValue =
  | { status: 'shown'; formValue: string | boolean | SchemaFormTextListLine[] }
  | { status: 'cannotBeShown' };

/** A value a graphic receives from a field the form edits. */
export type DataValueOfSchemaFormField = string | number | boolean | string[];

/** Why a typed text could not be read as data. */
export type ProblemReadingFormValue = 'notANumber' | 'notMinutesAndSeconds' | 'notADateAndTime';

/** What reading a control's value gives: nothing typed, a data value, or why not. */
export type DataValueReadFromFormValue =
  | { status: 'blank' }
  | { status: 'value'; value: DataValueOfSchemaFormField }
  | { status: 'unreadable'; problem: ProblemReadingFormValue };

// A plain decimal number, as a number input hands it over, with a comma also accepted
// because that is how a decimal is typed in Brazil. No exponent ("1e3"), no "0x10".
const plainNumberPattern = /^-?\d+([.,]\d+)?$/;

// The longest time an mm:ss field can hold: three digits of minutes (see minutesAndSeconds.ts).
const longestDurationShownInMilliseconds = (999 * 60 + 59) * 1_000 + 999;

const cannotBeShown: FormValueShownForDataValue = { status: 'cannotBeShown' };

/** Answers whether a data value is a list in which every entry is a text. */
function isListOfTexts(dataValue: unknown): dataValue is string[] {
  return Array.isArray(dataValue) && dataValue.every((entry) => typeof entry === 'string');
}

/**
 * Reads the lines of a list of texts into the data a graphic receives: each line without
 * the spaces around it, in order. An empty line is kept (as ''), so the check can name it
 * by its number instead of the list quietly losing a line the operator added.
 */
function readTextsOfLines(lines: SchemaFormTextListLine[]): string[] {
  return lines.map((line) => line.text.trim());
}

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
 * the dropdown does not have, a time past 999:59, a number JavaScript writes with an
 * exponent. The caller decides what to show instead. An unsupported field can never be
 * shown.
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
    case 'number': {
      if (!isNumberTheFieldCanHold(field, dataValue)) {
        return cannotBeShown;
      }
      // JavaScript writes a very small or very large number with an exponent ("1e-7",
      // "1e+21"), which the reader below refuses. Showing that text would make the form
      // invalid over a value nobody typed, so such a number counts as "cannot be shown"
      // and the caller lists the field for the operator instead.
      const digitsOfTheNumber = String(dataValue);
      return plainNumberPattern.test(digitsOfTheNumber)
        ? { status: 'shown', formValue: digitsOfTheNumber }
        : cannotBeShown;
    }
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
    case 'textList':
      return isListOfTexts(dataValue)
        ? { status: 'shown', formValue: dataValue.map((text) => ({ text })) }
        : cannotBeShown;
    case 'unsupported':
      return cannotBeShown;
  }
}

/**
 * Answers what the form holds for what a control reports or a filled form shows: null
 * (cleared) for a blank text in an optional typed field (text, number, mm:ss, date), and
 * the value itself in every other case. Blank is what readDataValueFromFormValue below
 * reads as blank: the empty text, or spaces only.
 * For those fields blank and cleared are one state. Holding it as one value, both when
 * the form is filled and when the operator empties the field, is what lets
 * react-hook-form see a field that was emptied again as unchanged.
 * What could go wrong: a space typed into an empty optional field is dropped at once,
 * since the field stays cleared; a space after the first letter is kept.
 */
export function clearBlankOptionalTypedFormValue(
  field: SchemaFormFieldDescription,
  formValue: SchemaFormFieldValue,
): SchemaFormFieldValue {
  const isTypedControl =
    field.control === 'text' ||
    field.control === 'number' ||
    field.control === 'duration' ||
    field.control === 'dateTime';
  const isBlankText = typeof formValue === 'string' && formValue.trim() === '';
  const isBlankOptionalTypedField = isBlankText && isTypedControl && !field.isRequired;
  // A list with no line left is blank too: an optional list emptied by its last
  // "Remover" is cleared, as an emptied optional text is.
  const isEmptyList = Array.isArray(formValue) && formValue.length === 0;
  const isEmptyOptionalList = isEmptyList && field.control === 'textList' && !field.isRequired;
  return isBlankOptionalTypedField || isEmptyOptionalList ? null : formValue;
}

/**
 * Turns what a field's control holds into the data value the graphic receives.
 * - Cleared (null), nothing typed, or only spaces: `blank`. Whether a blank is allowed
 *   is the caller's question (checkSchemaFormValues.ts). A list of texts with no line is
 *   blank; with lines, it is their texts, each trimmed, an empty line kept as ''.
 * - Typed text is sent without the spaces around it; a chosen option is sent as it is.
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
  // Only a list of texts holds lines, and it holds nothing else.
  if (Array.isArray(formValue) || field.control === 'textList') {
    const isListWithLines = Array.isArray(formValue) && formValue.length > 0;
    return isListWithLines && field.control === 'textList'
      ? { status: 'value', value: readTextsOfLines(formValue) }
      : { status: 'blank' };
  }
  if (typeof formValue === 'boolean') {
    // Only a switch holds true or false; anywhere else it is not a typed value.
    return field.control === 'switch' ? { status: 'value', value: formValue } : { status: 'blank' };
  }

  if (field.control === 'select') {
    // An option was chosen, not typed: it is sent exactly as the manifest wrote it, also
    // when that has a space at either end, or it would no longer be one of the options.
    return formValue === '' ? { status: 'blank' } : { status: 'value', value: formValue };
  }

  const typedText = formValue.trim();
  if (typedText === '' || field.control === 'switch') {
    return { status: 'blank' };
  }
  switch (field.control) {
    case 'text':
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
