/**
 * Reads a graphic's data schema (the `schema` of its OGraf manifest, JSON Schema draft
 * 2020-12) into the descriptions the form is drawn from. This is the only place that
 * knows which manifest keyword means what to the control page; packages/graphics/README.md
 * tells graphic authors the same list.
 *
 * The schema comes from the server typed as "anything" and was written by whoever made
 * the graphic, so nothing here trusts its shape: a keyword of the wrong type is ignored,
 * and a property the form cannot edit becomes the read-only `unsupported` control instead
 * of an error.
 */
import { ptBR } from '@/i18n/ptBR';

import { isPlainRecord, readOwnValueOfRecord } from './plainRecord';
import type {
  SchemaFormControl,
  SchemaFormDescription,
  SchemaFormFieldDescription,
  SchemaFormSelectOption,
} from './schemaFormDescription';

// Keywords that make a property's value depend on a choice between shapes. The form has
// one control per property, so it cannot edit any of them yet.
const keywordsOfShapesTheFormCannotEdit = ['oneOf', 'anyOf', 'allOf', 'not', '$ref'];

// Names react-hook-form refuses to write to, because writing them on a JavaScript object
// changes the object itself instead of adding a key.
const keysReactHookFormCannotHold = ['__proto__', 'constructor', 'prototype'];

// The characters at which react-hook-form cuts a field name into the steps of a path.
const charactersReactHookFormSplitsANameAt = ['.', '[', ']', "'", '"'];

/**
 * Answers whether a property key can be used as part of a react-hook-form field name.
 * react-hook-form reads a name as a path: `values.a.b` and `values.a[0]` mean "b inside
 * a" and "the first of a", a quote splits the name just as a dot does (`values.a'b` is
 * "b inside a"), and a key that starts with a digit is taken for a position in a list.
 * A property with such a key would be stored somewhere else than it is read from, so it
 * is shown as unsupported (read-only) instead. Conservative on purpose.
 * What could go wrong: the list below is the five characters react-hook-form 7 splits a
 * name at (`. [ ] ' "`). If a later version splits at more, they must be added here.
 */
function isKeySafeAsFormFieldName(key: string): boolean {
  const hasPathCharacter = charactersReactHookFormSplitsANameAt.some((character) =>
    key.includes(character),
  );
  const startsWithDigit = /^\d/.test(key);
  const isRefusedName = keysReactHookFormCannotHold.includes(key);
  return key !== '' && !hasPathCharacter && !startsWithDigit && !isRefusedName;
}

function readTextOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** The `v_baja` keyword of a property (our vendor field), or an empty object. */
function readBajaVendorKeywords(propertySchema: Record<string, unknown>): Record<string, unknown> {
  const vendorKeywords = readOwnValueOfRecord(propertySchema, 'v_baja');
  return isPlainRecord(vendorKeywords) ? vendorKeywords : {};
}

/**
 * The dropdown's choices for a property with `enum`, or undefined when the enum is not
 * one a dropdown can show: it must be a list of texts with at least one entry, none of
 * them empty (the shadcn/ui dropdown keeps the empty text for "nothing chosen").
 * The words come from OGraf's `gddOptions.labels`; a value with no label shows as itself.
 */
function readSelectOptions(
  propertySchema: Record<string, unknown>,
): SchemaFormSelectOption[] | undefined {
  const enumValues = readOwnValueOfRecord(propertySchema, 'enum');
  if (!Array.isArray(enumValues) || enumValues.length === 0) {
    return undefined;
  }
  const gddOptions = readOwnValueOfRecord(propertySchema, 'gddOptions');
  const labelsByValue = isPlainRecord(gddOptions)
    ? readOwnValueOfRecord(gddOptions, 'labels')
    : undefined;

  const selectOptions: SchemaFormSelectOption[] = [];
  for (const enumValue of enumValues) {
    if (typeof enumValue !== 'string' || enumValue === '') {
      return undefined;
    }
    const labelFromManifest = isPlainRecord(labelsByValue)
      ? readTextOrUndefined(readOwnValueOfRecord(labelsByValue, enumValue))
      : undefined;
    selectOptions.push({ value: enumValue, label: labelFromManifest ?? enumValue });
  }
  return selectOptions;
}

/**
 * Answers whether a list property is a list of plain texts the form can edit line by line:
 * `items` is an object with `type: string` and nothing that makes a line something else
 * (a fixed list of values, a date, a choice between shapes). A list of objects (the
 * tower's cars) stays unsupported: it is read from a source or shown read-only.
 */
function isListOfPlainTexts(propertySchema: Record<string, unknown>): boolean {
  const itemsSchema = readOwnValueOfRecord(propertySchema, 'items');
  if (!isPlainRecord(itemsSchema)) {
    return false;
  }
  const isText = readOwnValueOfRecord(itemsSchema, 'type') === 'string';
  const hasFixedValues = Object.hasOwn(itemsSchema, 'enum');
  const hasFormat = Object.hasOwn(itemsSchema, 'format');
  const hasShapeChoice = keywordsOfShapesTheFormCannotEdit.some((keyword) =>
    Object.hasOwn(itemsSchema, keyword),
  );
  return isText && !hasFixedValues && !hasFormat && !hasShapeChoice;
}

/** The `items` schema of a list property, or an empty object. */
function readItemsSchema(propertySchema: Record<string, unknown>): Record<string, unknown> {
  const itemsSchema = readOwnValueOfRecord(propertySchema, 'items');
  return isPlainRecord(itemsSchema) ? itemsSchema : {};
}

/** Chooses the control for one property; see SchemaFormControl for what each one is. */
function chooseControlForProperty(
  key: string,
  propertySchema: Record<string, unknown>,
  selectOptions: SchemaFormSelectOption[] | undefined,
  isWallClockMoment: boolean,
): SchemaFormControl {
  if (!isKeySafeAsFormFieldName(key)) {
    return 'unsupported';
  }
  const hasShapeTheFormCannotEdit = keywordsOfShapesTheFormCannotEdit.some((keyword) =>
    Object.hasOwn(propertySchema, keyword),
  );
  if (hasShapeTheFormCannotEdit) {
    return 'unsupported';
  }

  const hasEnum = Object.hasOwn(propertySchema, 'enum');
  const type = readOwnValueOfRecord(propertySchema, 'type');
  if (type === 'string') {
    if (hasEnum) {
      return selectOptions === undefined ? 'unsupported' : 'select';
    }
    const isDateAndTime = readOwnValueOfRecord(propertySchema, 'format') === 'date-time';
    return isDateAndTime ? 'dateTime' : 'text';
  }
  if (type === 'integer' || type === 'number') {
    // A number picked from a fixed list would need a dropdown of numbers; not before M3.
    if (hasEnum) {
      return 'unsupported';
    }
    // A moment typed as a date and time, sent as milliseconds since 1970 (a session's start,
    // BAJAOVRLAY-46): `v_baja.unit: "epochMs"` on a whole number.
    const unit = readBajaVendorKeywords(propertySchema).unit;
    if (type === 'integer' && unit === 'epochMs' && !isWallClockMoment) {
      return 'dateTime';
    }
    // A wall-clock moment is thirteen digits of milliseconds since 1970, never an mm:ss.
    const isInMilliseconds = unit === 'ms';
    return isInMilliseconds && !isWallClockMoment ? 'duration' : 'number';
  }
  if (type === 'boolean') {
    return 'switch';
  }
  if (type === 'array' && isListOfPlainTexts(propertySchema)) {
    return 'textList';
  }
  // Other lists, nested objects, `type` given as a list of types, or no `type` at all.
  return 'unsupported';
}

/** Describes one property of the schema. A property that is not an object is unsupported. */
function describeProperty(
  key: string,
  propertySchemaAsWritten: unknown,
  requiredKeys: string[],
): SchemaFormFieldDescription {
  const propertySchema = isPlainRecord(propertySchemaAsWritten) ? propertySchemaAsWritten : {};
  const type = readOwnValueOfRecord(propertySchema, 'type');
  const isWholeNumber = type === 'integer';
  const role = readTextOrUndefined(readBajaVendorKeywords(propertySchema).role);
  const isWallClockMoment = isWholeNumber && role === 'wallClock';
  const selectOptions = readSelectOptions(propertySchema);
  const control = chooseControlForProperty(key, propertySchema, selectOptions, isWallClockMoment);
  // A list's length limits are its lines' own, written on `items` (JSON Schema's rule).
  const isTextList = control === 'textList';
  const schemaOfTheText = isTextList ? readItemsSchema(propertySchema) : propertySchema;
  const listItemTitle = readTextOrUndefined(readOwnValueOfRecord(schemaOfTheText, 'title'));

  return {
    key,
    label: readTextOrUndefined(readOwnValueOfRecord(propertySchema, 'title')) ?? key,
    help: readTextOrUndefined(readOwnValueOfRecord(propertySchema, 'description')),
    isRequired: requiredKeys.includes(key),
    control,
    selectOptions: control === 'select' && selectOptions !== undefined ? selectOptions : [],
    isWholeNumber,
    minimum: readNumberOrUndefined(readOwnValueOfRecord(propertySchema, 'minimum')),
    maximum: readNumberOrUndefined(readOwnValueOfRecord(propertySchema, 'maximum')),
    minimumLength: readNumberOrUndefined(readOwnValueOfRecord(schemaOfTheText, 'minLength')),
    maximumLength: readNumberOrUndefined(readOwnValueOfRecord(schemaOfTheText, 'maxLength')),
    minimumItems: isTextList
      ? readNumberOrUndefined(readOwnValueOfRecord(propertySchema, 'minItems'))
      : undefined,
    maximumItems: isTextList
      ? readNumberOrUndefined(readOwnValueOfRecord(propertySchema, 'maxItems'))
      : undefined,
    listItemLabel: isTextList ? (listItemTitle ?? ptBR.textList.defaultItemLabel) : undefined,
    offersTakeTime: control === 'number' && isWallClockMoment,
    role,
    defaultDataValue: readOwnValueOfRecord(propertySchema, 'default'),
  };
}

/**
 * Reads a manifest's data schema into the form's descriptions.
 * - No schema at all (OGraf allows a graphic that takes no data): no fields.
 * - A schema that is not `type: object` with a `properties` object: no fields, and
 *   `isWholeDataSchemaUnsupported` is true (the form shows one read-only JSON box).
 * - Otherwise one description per property, in the manifest's order.
 * What could go wrong: JavaScript lists keys that look like whole numbers ("1", "42")
 * before all others, whatever the manifest's order. Such keys are unsupported anyway.
 */
export function describeSchemaFormFromDataSchema(dataSchema: unknown): SchemaFormDescription {
  if (dataSchema === undefined || dataSchema === null) {
    return { fields: [], isWholeDataSchemaUnsupported: false, dataSchema };
  }
  const properties = isPlainRecord(dataSchema)
    ? readOwnValueOfRecord(dataSchema, 'properties')
    : undefined;
  const isObjectWithProperties =
    isPlainRecord(dataSchema) &&
    readOwnValueOfRecord(dataSchema, 'type') === 'object' &&
    isPlainRecord(properties);
  if (!isObjectWithProperties || !isPlainRecord(properties)) {
    return { fields: [], isWholeDataSchemaUnsupported: true, dataSchema };
  }

  const requiredAsWritten = readOwnValueOfRecord(dataSchema, 'required');
  const requiredKeys = Array.isArray(requiredAsWritten)
    ? requiredAsWritten.filter((requiredKey) => typeof requiredKey === 'string')
    : [];
  const fields = Object.entries(properties).map(([key, propertySchema]) =>
    describeProperty(key, propertySchema, requiredKeys),
  );
  return { fields, isWholeDataSchemaUnsupported: false, dataSchema };
}
