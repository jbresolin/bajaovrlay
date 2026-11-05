import {
  buildEventLogNamesFromSlices,
  describeEventLogEntry,
  doesEventLogEntryMatchFilters,
  type EventLogEntry,
  type EventLogFilters,
  type EventLogPage,
  type EventLogPageQuery,
  type Slices,
} from '@bajaovrlay/shared';

// How many rows are read from the database at a time while looking for the rows of a
// filtered page. Large enough that an unfiltered page is one read, small enough that a
// filter matching little never holds the whole log in memory at once.
const rowsReadPerBatch = 500;

/**
 * One page of the history's older rows (GET /api/v1/event-log, BAJAOVRLAY-30): the rows
 * below `query.before` that pass the filters, newest first, `query.limit` of them at most,
 * and whether more such rows lie below. A row is filtered on its pt-BR sentence, written
 * with the names the slices hold now, exactly as the page writes its live rows
 * (describeEventLogEntry), so a filter keeps the same rows on both.
 * What could go wrong: a filter that matches nothing reads the whole table, batch by batch;
 * on a race day's log that is tens of thousands of short rows, which SQLite reads in well
 * under a second.
 */
export function readFilteredEventLogPage(
  readEntriesBelow: (beforeId: number | undefined, limit: number) => EventLogEntry[],
  slices: Slices,
  query: EventLogPageQuery,
): EventLogPage {
  const names = buildEventLogNamesFromSlices(slices);
  const filters = readFiltersOfQuery(query);
  const entriesOfThePage: EventLogEntry[] = [];
  let beforeId = query.before;
  // One more than the page holds is looked for, so its presence says whether there is more.
  while (entriesOfThePage.length <= query.limit) {
    const batch = readEntriesBelow(beforeId, rowsReadPerBatch);
    for (const entry of batch) {
      const described = describeEventLogEntry(entry, names);
      if (doesEventLogEntryMatchFilters(described, filters)) {
        entriesOfThePage.push(entry);
      }
      if (entriesOfThePage.length > query.limit) {
        break;
      }
    }
    const isTheEndOfTheLog = batch.length < rowsReadPerBatch;
    if (isTheEndOfTheLog) {
      break;
    }
    beforeId = batch.at(-1)?.id;
  }
  const hasOlder = entriesOfThePage.length > query.limit;
  return { entries: entriesOfThePage.slice(0, query.limit), hasOlder };
}

/** The filters the query names, leaving out the ones it does not. */
function readFiltersOfQuery(query: EventLogPageQuery): EventLogFilters {
  const filters: EventLogFilters = {};
  if (query.who !== undefined) {
    filters.who = query.who;
  }
  if (query.group !== undefined) {
    filters.group = query.group;
  }
  if (query.layerId !== undefined) {
    filters.layerId = query.layerId;
  }
  if (query.onlyRefusals !== undefined) {
    filters.onlyRefusals = query.onlyRefusals;
  }
  if (query.text !== undefined) {
    filters.text = query.text;
  }
  return filters;
}
