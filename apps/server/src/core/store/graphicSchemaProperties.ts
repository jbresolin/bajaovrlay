import type { Graphic } from '@bajaovrlay/shared';

/**
 * Says whether a value read from a manifest is a plain object (not a list, not null),
 * so its fields can be read by name.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns what the graphic's data schema says about one top-level data field (the entry
 * of `schema.properties` with that key), or undefined when the manifest has no schema,
 * the schema has no usable `properties`, or the field is not declared there.
 * Only a property the schema itself declares counts: a key such as `constructor`,
 * which every JavaScript object answers to, is not found unless the manifest wrote it.
 */
export function readSchemaPropertyOfGraphic(
  graphic: Graphic,
  fieldKey: string,
): Record<string, unknown> | undefined {
  const manifestSchema = graphic.manifest.schema;
  if (manifestSchema === undefined) {
    return undefined;
  }
  const schemaProperties = manifestSchema.properties;
  if (!isPlainObject(schemaProperties)) {
    return undefined;
  }
  if (!Object.hasOwn(schemaProperties, fieldKey)) {
    return undefined;
  }
  const schemaProperty = schemaProperties[fieldKey];
  return isPlainObject(schemaProperty) ? schemaProperty : undefined;
}

/**
 * Says whether the server may write the moment of a command into this data field: the
 * graphic's schema must declare it as a whole number (`type: "integer"`) and mark it as
 * a wall-clock moment (`v_baja.role: "wallClock"`). A graphic without a data schema has
 * no such field, so nothing of it can be stamped.
 */
export function isFieldAWallClockMomentOfGraphic(graphic: Graphic, fieldKey: string): boolean {
  const schemaProperty = readSchemaPropertyOfGraphic(graphic, fieldKey);
  if (schemaProperty === undefined) {
    return false;
  }
  const isAWholeNumber = schemaProperty.type === 'integer';
  const vendorHints = schemaProperty.v_baja;
  const isMarkedAsWallClock = isPlainObject(vendorHints) && vendorHints.role === 'wallClock';
  return isAWholeNumber && isMarkedAsWallClock;
}

/**
 * Returns the first field named in `takeTimeFieldKeys` that the server may not stamp
 * for this graphic, or undefined when every one of them is a wall-clock moment in the
 * graphic's schema. Without this check any client could have the server write a number
 * into any field of any graphic.
 */
export function findTakeTimeFieldKeyGraphicCannotStamp(
  graphic: Graphic,
  takeTimeFieldKeys: string[],
): string | undefined {
  return takeTimeFieldKeys.find((fieldKey) => !isFieldAWallClockMomentOfGraphic(graphic, fieldKey));
}

// The four parts of a clock, as the race clock's manifest marks them with `v_baja.role`
// (the same words carryClockForward reads): the time read, the moment it was read,
// whether it runs, which way it counts.
const clockRoles: readonly string[] = ['clockTime', 'wallClock', 'clockRunning', 'clockMode'];

/**
 * The keys of the graphic's data fields that are part of a clock: every top-level field
 * whose `v_baja.role` is one of clockTime, wallClock, clockRunning or clockMode. None for a
 * graphic without a data schema. These fields only mean something together, which is why
 * "Salvar no item" saves them as one (saveOnAirChangesIntoItem.ts).
 */
export function listClockFieldKeysOfGraphic(graphic: Graphic): string[] {
  const schemaProperties = graphic.manifest.schema?.properties;
  if (!isPlainObject(schemaProperties)) {
    return [];
  }
  const clockFieldKeys: string[] = [];
  for (const fieldKey of Object.keys(schemaProperties)) {
    const vendorHints = readSchemaPropertyOfGraphic(graphic, fieldKey)?.v_baja;
    const role = isPlainObject(vendorHints) ? vendorHints.role : undefined;
    if (typeof role === 'string' && clockRoles.includes(role)) {
      clockFieldKeys.push(fieldKey);
    }
  }
  return clockFieldKeys;
}

/**
 * The keys the graphic's data schema lists under `required`, or none when the manifest
 * has no schema or no usable list. The resolver leaves an optional field out when its
 * bound value is absent, and refuses the take for a required one.
 */
export function listRequiredFieldKeysOfGraphic(graphic: Graphic): string[] {
  const requiredFieldKeys = graphic.manifest.schema?.required;
  if (!Array.isArray(requiredFieldKeys)) {
    return [];
  }
  return requiredFieldKeys.filter((fieldKey): fieldKey is string => typeof fieldKey === 'string');
}
