import type { z } from 'zod';

/**
 * Reports every record whose key an earlier record already has, at that record's key
 * field, with the sentence `describeRepeat` writes. The four slices and the four imports
 * run it on their list, so a car number or an id appears once wherever records are
 * listed together: which of two rows with one key wins would otherwise be a guess.
 * The path is the record's place in the list; Zod puts the list's own path before it
 * (`records.1.carNumber` in an import).
 */
export function reportKeysListedTwice<KeyValue extends string | number>(
  keys: KeyValue[],
  keyFieldName: string,
  describeRepeat: (repeatedKey: KeyValue) => string,
  context: z.RefinementCtx,
): void {
  const keysSeen = new Set<KeyValue>();
  keys.forEach((key, index) => {
    if (keysSeen.has(key)) {
      context.addIssue({
        code: 'custom',
        path: [index, keyFieldName],
        message: describeRepeat(key),
      });
    }
    keysSeen.add(key);
  });
}
