/**
 * Whether a Fontes table row may skip its redraw: React.memo's own check compares objects
 * by identity, and every poll brings new objects for the very same cars, so it would
 * never skip. These compare a row's entries by value (areJsonValuesEqual: a standings
 * row's points by event is an object of its own), which lets the rows of the cars a poll
 * did not change stay as they are.
 */
import { areJsonValuesEqual } from '@bajaovrlay/shared';

/** One car's row as the tables draw it: its entry, what the source sent, the corrections. */
type TableRowProps<Entry extends object, Corrections> = {
  entry: Entry;
  entryAsSent: Entry | undefined;
  corrections: Corrections;
};

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
    areJsonValuesEqual(previousRow.entry, nextRow.entry) &&
    areJsonValuesEqual(previousRow.entryAsSent, nextRow.entryAsSent)
  );
}
