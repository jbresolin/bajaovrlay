import { type BindableValueType, findBindablePath } from '../dataShapes/bindablePaths.js';
import type { Graphic } from '../slices/graphic.js';
import type { BindingFieldValue } from './bindingFieldValue.js';
import { findProblemInBinding, findValueTypeOfBinding } from './bindingProblems.js';
import { ptBRBindings } from './ptBRBindings.js';

/**
 * The keys of a graphic's four clock fields, by the `v_baja.role` its manifest marks
 * each with: the time read (clockTime), the moment it was read (wallClock), whether it
 * runs (clockRunning) and which way it counts (clockMode).
 */
export type ClockFieldKeysByRole = {
  clockTime: string;
  wallClock: string;
  clockRunning: string;
  clockMode: string;
};

/** Says whether a value read from a manifest is a plain object, so its fields can be read. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `properties` of a manifest's data schema, or undefined when it has none. */
function readPropertiesOfDataSchema(dataSchema: unknown): Record<string, unknown> | undefined {
  const schemaProperties = isPlainObject(dataSchema) ? dataSchema.properties : undefined;
  return isPlainObject(schemaProperties) ? schemaProperties : undefined;
}

/**
 * What a data schema says about one top-level field, or undefined when there is no schema
 * or it does not declare the field (a key such as `constructor` is not found unless the
 * manifest wrote it). Also read by the entity references' fit (entities/).
 */
export function readSchemaPropertyOfField(
  dataSchema: unknown,
  fieldKey: string,
): Record<string, unknown> | undefined {
  const schemaProperties = readPropertiesOfDataSchema(dataSchema);
  if (schemaProperties === undefined || !Object.hasOwn(schemaProperties, fieldKey)) {
    return undefined;
  }
  const schemaProperty = schemaProperties[fieldKey];
  return isPlainObject(schemaProperty) ? schemaProperty : undefined;
}

/** The `v_baja.role` a data schema marks one field with, or undefined. */
function readRoleOfField(dataSchema: unknown, fieldKey: string): string | undefined {
  const vendorHints = readSchemaPropertyOfField(dataSchema, fieldKey)?.v_baja;
  const role = isPlainObject(vendorHints) ? vendorHints.role : undefined;
  return typeof role === 'string' ? role : undefined;
}

/**
 * Finds the graphic's four clock fields by role, or undefined unless it marks all four.
 * The clock group is offered, and resolved, only for such a graphic: it fills the four
 * at once, so the clock never shows a new time with an old moment. Named by roles,
 * never by a graphic, so no code here belongs to the race clock.
 */
export function findClockFieldKeysByRole(graphic: Graphic): ClockFieldKeysByRole | undefined {
  return findClockFieldKeysByRoleInDataSchema(graphic.manifest.schema);
}

/** findClockFieldKeysByRole for a manifest's data schema alone (the generated form has it). */
export function findClockFieldKeysByRoleInDataSchema(
  dataSchema: unknown,
): ClockFieldKeysByRole | undefined {
  const schemaProperties = readPropertiesOfDataSchema(dataSchema);
  if (schemaProperties === undefined) {
    return undefined;
  }
  const fieldKeys = Object.keys(schemaProperties);
  const findFieldOfRole = (role: string) =>
    fieldKeys.find((fieldKey) => readRoleOfField(dataSchema, fieldKey) === role);
  const clockTime = findFieldOfRole('clockTime');
  const wallClock = findFieldOfRole('wallClock');
  const clockRunning = findFieldOfRole('clockRunning');
  const clockMode = findFieldOfRole('clockMode');
  if (
    clockTime === undefined ||
    wallClock === undefined ||
    clockRunning === undefined ||
    clockMode === undefined
  ) {
    return undefined;
  }
  return { clockTime, wallClock, clockRunning, clockMode };
}

/**
 * Lists the value types a binding may give to one field of a graphic, read from the
 * field's JSON Schema `type`: text (and the flag) for a string, whole numbers for an
 * integer, any number for a number, yes/no for a boolean, a whole list for an array.
 * The clock group goes on the field with the role clockTime of a graphic that marks all
 * four clock roles, and on no other. An object field, or one the schema does not
 * declare, takes nothing.
 * What could go wrong: the type is checked here, not the enum or the limits; a flag
 * value the field's enum lacks is refused by the manifest schema at the take.
 */
export function listValueTypesThatFitGraphicField(
  graphic: Graphic,
  fieldKey: string,
): BindableValueType[] {
  return listValueTypesThatFitDataSchemaField(graphic.manifest.schema, fieldKey);
}

/** listValueTypesThatFitGraphicField for a manifest's data schema alone. */
export function listValueTypesThatFitDataSchemaField(
  dataSchema: unknown,
  fieldKey: string,
): BindableValueType[] {
  const schemaProperty = readSchemaPropertyOfField(dataSchema, fieldKey);
  if (schemaProperty === undefined) {
    return [];
  }
  const valueTypes = listValueTypesOfJsonSchemaType(schemaProperty.type);
  const clockFieldKeys = findClockFieldKeysByRoleInDataSchema(dataSchema);
  const isTheClockTimeOfAWholeClock = clockFieldKeys?.clockTime === fieldKey;
  if (isTheClockTimeOfAWholeClock) {
    valueTypes.push('clockGroup');
  }
  return valueTypes;
}

/** The value types one JSON Schema `type` takes; nothing for an object or an unknown type. */
function listValueTypesOfJsonSchemaType(jsonSchemaType: unknown): BindableValueType[] {
  switch (jsonSchemaType) {
    case 'string':
      return ['text', 'stateEnum'];
    case 'integer':
      return ['integer'];
    case 'number':
      return ['integer', 'number'];
    case 'boolean':
      return ['boolean'];
    case 'array':
      return [
        'positionsEntries',
        'standingsEntries',
        'standingsScoreParts',
        'bracketsRounds',
        'incidentsEntries',
      ];
    default:
      return [];
  }
}

/**
 * Says what is wrong with storing this binding on this field of the graphic, as one
 * pt-BR sentence (the server puts the field's title before it), or undefined when it
 * fits. The binding's own problem comes first, because it is the real cause.
 */
export function findProblemInBindingForGraphicField(
  binding: BindingFieldValue,
  graphic: Graphic,
  fieldKey: string,
): string | undefined {
  return findProblemInBindingForDataSchemaField(binding, graphic.manifest.schema, fieldKey);
}

/** findProblemInBindingForGraphicField for a manifest's data schema alone. */
export function findProblemInBindingForDataSchemaField(
  binding: BindingFieldValue,
  dataSchema: unknown,
  fieldKey: string,
): string | undefined {
  const problemOfTheBinding = findProblemInBinding(binding);
  if (problemOfTheBinding !== undefined) {
    return problemOfTheBinding;
  }
  const valueType = findValueTypeOfBinding(binding);
  const typesThatFit = listValueTypesThatFitDataSchemaField(dataSchema, fieldKey);
  if (valueType !== undefined && typesThatFit.includes(valueType)) {
    return undefined;
  }
  const pathLabel = findBindablePath(binding.shapeKey, binding.path)?.label ?? binding.path;
  return ptBRBindings.fieldFitProblems.valueDoesNotFitField(pathLabel);
}
