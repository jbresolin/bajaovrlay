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

/**
 * What the graphic's data schema says about one top-level field, or undefined when the
 * manifest has no schema or does not declare the field (a key such as `constructor` is
 * not found unless the manifest wrote it).
 */
function readSchemaPropertyOfField(
  graphic: Graphic,
  fieldKey: string,
): Record<string, unknown> | undefined {
  const schemaProperties = graphic.manifest.schema?.properties;
  if (!isPlainObject(schemaProperties) || !Object.hasOwn(schemaProperties, fieldKey)) {
    return undefined;
  }
  const schemaProperty = schemaProperties[fieldKey];
  return isPlainObject(schemaProperty) ? schemaProperty : undefined;
}

/** The `v_baja.role` a manifest marks one field with, or undefined. */
function readRoleOfField(graphic: Graphic, fieldKey: string): string | undefined {
  const vendorHints = readSchemaPropertyOfField(graphic, fieldKey)?.v_baja;
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
  const schemaProperties = graphic.manifest.schema?.properties;
  if (!isPlainObject(schemaProperties)) {
    return undefined;
  }
  const fieldKeys = Object.keys(schemaProperties);
  const clockTime = fieldKeys.find(
    (fieldKey) => readRoleOfField(graphic, fieldKey) === 'clockTime',
  );
  const wallClock = fieldKeys.find(
    (fieldKey) => readRoleOfField(graphic, fieldKey) === 'wallClock',
  );
  const clockRunning = fieldKeys.find(
    (fieldKey) => readRoleOfField(graphic, fieldKey) === 'clockRunning',
  );
  const clockMode = fieldKeys.find(
    (fieldKey) => readRoleOfField(graphic, fieldKey) === 'clockMode',
  );
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
  const schemaProperty = readSchemaPropertyOfField(graphic, fieldKey);
  if (schemaProperty === undefined) {
    return [];
  }
  const valueTypes = listValueTypesOfJsonSchemaType(schemaProperty.type);
  const clockFieldKeys = findClockFieldKeysByRole(graphic);
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
      return ['positionsEntries', 'standingsEntries', 'bracketsRounds'];
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
  const problemOfTheBinding = findProblemInBinding(binding);
  if (problemOfTheBinding !== undefined) {
    return problemOfTheBinding;
  }
  const valueType = findValueTypeOfBinding(binding);
  const typesThatFit = listValueTypesThatFitGraphicField(graphic, fieldKey);
  if (valueType !== undefined && typesThatFit.includes(valueType)) {
    return undefined;
  }
  const pathLabel = findBindablePath(binding.shapeKey, binding.path)?.label ?? binding.path;
  return ptBRBindings.fieldFitProblems.valueDoesNotFitField(pathLabel);
}
