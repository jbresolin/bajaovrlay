/**
 * The top-level fields of a command's data, split by what the sender asked for: the
 * fields sent as `null` (cleared) and the fields that carry a value.
 */
export type ClearedAndValuedFields = {
  /** The keys sent as `null`, in the order they were sent. */
  keysOfClearedFields: string[];
  /** Every other field, exactly as sent. */
  fieldsWithAValue: Record<string, unknown>;
};

/**
 * Splits a command's data into the fields sent as `null` and the fields that carry a
 * value. `null` at the top level is how a client says "this field is cleared": a
 * graphic's schema describes an optional field as "may be left out", never as "may be
 * null", so the reducers must take such a field out before the schema check.
 * Only the top level is read: a null inside an object or a list is a value like any
 * other and is left for the graphic's schema to accept or refuse. Pure; `data` is not
 * changed.
 */
export function separateClearedFieldsFromData(
  data: Record<string, unknown>,
): ClearedAndValuedFields {
  const keysOfClearedFields: string[] = [];
  const keysAndValuesKept: Array<[string, unknown]> = [];
  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    if (fieldValue === null) {
      keysOfClearedFields.push(fieldKey);
    } else {
      keysAndValuesKept.push([fieldKey, fieldValue]);
    }
  }
  // Built from pairs so that a field key such as `__proto__` becomes an ordinary key of
  // the data instead of changing what kind of object the data is.
  return { keysOfClearedFields, fieldsWithAValue: Object.fromEntries(keysAndValuesKept) };
}

/**
 * Returns the data with each field named in `takeTimeFieldKeys` holding the moment of
 * the command in wall-clock milliseconds, whatever the field held before (or if it was
 * not there). `momentOfTheCommand` is the reducer context's `now` (ISO 8601 text), the
 * same moment the instance's `takenAt` and the event log say, and it is converted
 * exactly as resolveItemFieldsIntoGraphicData converts it for an item's `takeTime`
 * field, so an update on air and a take of an item stamp the same number.
 * Pure: it reads no clock and does not change `data`.
 * What could go wrong: a moment that is not a date gives NaN, which a schema asking for
 * a whole number then refuses; the store always writes the moment with toISOString.
 */
export function stampFieldsWithMomentOfTheCommand(
  data: Record<string, unknown>,
  takeTimeFieldKeys: string[],
  momentOfTheCommand: string,
): Record<string, unknown> {
  const momentOfTheCommandInMilliseconds = Date.parse(momentOfTheCommand);
  const keysAndValuesOfTheData = Object.entries(data);
  const keysAndValuesOfTheStamps: Array<[string, unknown]> = takeTimeFieldKeys.map((fieldKey) => [
    fieldKey,
    momentOfTheCommandInMilliseconds,
  ]);
  // The stamps come last, so a stamped key replaces the value the data carried for it.
  return Object.fromEntries([...keysAndValuesOfTheData, ...keysAndValuesOfTheStamps]);
}
