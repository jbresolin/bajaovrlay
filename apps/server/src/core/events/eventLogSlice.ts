import type { EventLogEntry } from '@bajaovrlay/shared';

/**
 * How many of the newest event-log entries the `eventLog` slice keeps. The slice is
 * broadcast to every client after every logged command, so keeping the whole race day in it
 * would make every message grow all day; the database keeps every entry regardless.
 */
export const eventLogSliceSize = 200;

/**
 * Returns a new event-log slice with `newEntry` appended at the end and, when the
 * slice was full, the oldest entry dropped. The given slice is never changed.
 */
export function appendToEventLogSlice(
  currentEntries: EventLogEntry[],
  newEntry: EventLogEntry,
): EventLogEntry[] {
  const entriesWithNewOne = [...currentEntries, newEntry];
  const numberOfEntriesToDrop = Math.max(0, entriesWithNewOne.length - eventLogSliceSize);
  return entriesWithNewOne.slice(numberOfEntriesToDrop);
}
