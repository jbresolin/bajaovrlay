import {
  type DescribedEventLogEntry,
  describeEventLogEntry,
  doesEventLogEntryMatchFilters,
  type EventLogEntry,
  type EventLogFilters,
  type EventLogNames,
} from '@bajaovrlay/shared';

/**
 * The rows the history shows, newest first: the rows heard live and the older pages read
 * from the server, each once (a row can be in both while the live slice moves on), each
 * described in pt-BR with the names the page holds now, kept when it passes the filters.
 * The older pages were filtered by the server already; they are checked again here with
 * the same shared rule, which keeps them, so the one list reads alike from top to bottom.
 */
export function listHistoryRows(parts: {
  entriesHeardLive: EventLogEntry[];
  olderEntries: EventLogEntry[];
  names: EventLogNames;
  filters: EventLogFilters;
}): DescribedEventLogEntry[] {
  const entriesById = new Map<number, EventLogEntry>();
  for (const entry of [...parts.olderEntries, ...parts.entriesHeardLive]) {
    entriesById.set(entry.id, entry);
  }
  const entriesNewestFirst = [...entriesById.values()].sort(
    (oneEntry, otherEntry) => otherEntry.id - oneEntry.id,
  );
  const rows: DescribedEventLogEntry[] = [];
  for (const entry of entriesNewestFirst) {
    const described = describeEventLogEntry(entry, parts.names);
    if (doesEventLogEntryMatchFilters(described, parts.filters)) {
      rows.push(described);
    }
  }
  return rows;
}

/**
 * The live rows heard so far, the newest slice laid over the ones before, each row once.
 * The eventLog slice keeps only the newest 200 rows, so a row that drops out of it while
 * the page is open stays here; without it a busy hour would open a gap between the live
 * rows and the older pages already read. Lost on a reload, like the page's filters.
 */
export function addEntriesHeardLive(
  entriesHeardBefore: EventLogEntry[],
  liveSlice: EventLogEntry[],
): EventLogEntry[] {
  const idsHeardBefore = new Set(entriesHeardBefore.map((entry) => entry.id));
  const newEntries = liveSlice.filter((entry) => !idsHeardBefore.has(entry.id));
  if (newEntries.length === 0) {
    return entriesHeardBefore;
  }
  return [...entriesHeardBefore, ...newEntries];
}

/** The id the next older page starts below: the oldest row the page holds; none if empty. */
export function findIdToLoadOlderRowsBelow(
  entriesHeardLive: EventLogEntry[],
  olderEntries: EventLogEntry[],
): number | undefined {
  const everyId = [...entriesHeardLive, ...olderEntries].map((entry) => entry.id);
  if (everyId.length === 0) {
    return undefined;
  }
  return Math.min(...everyId);
}
