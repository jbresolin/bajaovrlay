/**
 * Two small, careful ways of reading an object whose shape nobody has promised: a
 * manifest's JSON Schema, the data of an instance on air, the stored fields of an item.
 * All three arrive from the server typed as "anything", and a key in them is chosen by
 * whoever wrote the manifest.
 */

/** Answers whether a value is an object with keys (not null, not a list). */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the value an object holds under `key`, or undefined when the object itself has
 * no such key.
 * What could go wrong without it: `record[key]` also finds what every JavaScript object
 * inherits, so a property a manifest names `toString` or `constructor` would read as a
 * function that was never in the data.
 */
export function readOwnValueOfRecord<ValueInRecord>(
  record: Record<string, ValueInRecord>,
  key: string,
): ValueInRecord | undefined {
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }
  return record[key];
}
