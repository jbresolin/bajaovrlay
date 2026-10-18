/**
 * Whether two values made of JSON (objects, arrays, strings, numbers, booleans, null)
 * hold the same content, whatever the order of the keys of their objects. Used to tell a
 * poll or an edit that repeats what is stored, so the reducer hands back the same slices.
 * Comparing JSON.stringify of both would depend on key order, which differs between a
 * config built in memory and the same config read back from the database.
 */
export function areJsonValuesEqual(first: unknown, second: unknown): boolean {
  if (first === second) {
    return true;
  }
  const isFirstAnObject = typeof first === 'object' && first !== null;
  const isSecondAnObject = typeof second === 'object' && second !== null;
  if (!isFirstAnObject || !isSecondAnObject) {
    return false;
  }

  if (Array.isArray(first) || Array.isArray(second)) {
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) {
      return false;
    }
    return first.every((firstItem, index) => areJsonValuesEqual(firstItem, second[index]));
  }

  // Two plain objects: the same keys, each holding an equal value. A key whose value is
  // undefined is not JSON and counts as absent, as it would once saved.
  const firstEntries = Object.entries(first).filter(([, value]) => value !== undefined);
  const secondEntries = Object.entries(second).filter(([, value]) => value !== undefined);
  if (firstEntries.length !== secondEntries.length) {
    return false;
  }
  const secondValuesByKey = new Map(secondEntries);
  return firstEntries.every(
    ([key, firstValue]) =>
      secondValuesByKey.has(key) && areJsonValuesEqual(firstValue, secondValuesByKey.get(key)),
  );
}
