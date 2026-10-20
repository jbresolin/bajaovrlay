/**
 * Whether a Fontes table row may skip its redraw: React.memo's own check compares objects
 * by identity, and every poll brings new objects for the very same cars, so it would
 * never skip. These compare a row's entries field by field (an entry is flat: numbers and
 * texts), which lets the rows of the cars a poll did not change stay as they are.
 */

/** One car's row as the tables draw it: its entry, what the source sent, the corrections. */
type TableRowProps<Entry extends object, Corrections> = {
  entry: Entry;
  entryAsSent: Entry | undefined;
  corrections: Corrections;
};

/** Whether two flat entries hold the same value in every field. */
export function isEntryTheSameFieldByField(
  previousEntry: object | undefined,
  nextEntry: object | undefined,
): boolean {
  if (previousEntry === nextEntry) {
    return true;
  }
  if (previousEntry === undefined || nextEntry === undefined) {
    return false;
  }
  const previousFields = Object.entries(previousEntry);
  const nextFieldCount = Object.keys(nextEntry).length;
  if (previousFields.length !== nextFieldCount) {
    return false;
  }
  return previousFields.every(
    ([fieldName, previousValue]) =>
      (nextEntry as Record<string, unknown>)[fieldName] === previousValue,
  );
}

/**
 * React.memo's check for a table row: the same car data, the same data as sent, and the
 * same corrections (the detail keeps that object while the corrections stay the same).
 */
export function isTableRowTheSame<Entry extends object, Corrections>(
  previousRow: TableRowProps<Entry, Corrections>,
  nextRow: TableRowProps<Entry, Corrections>,
): boolean {
  return (
    previousRow.corrections === nextRow.corrections &&
    isEntryTheSameFieldByField(previousRow.entry, nextRow.entry) &&
    isEntryTheSameFieldByField(previousRow.entryAsSent, nextRow.entryAsSent)
  );
}
