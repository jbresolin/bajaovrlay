import {
  describeEventLogEntry,
  doesEventLogEntryMatchFilters,
  type EventLogEntry,
  type EventLogFilters,
  type EventLogNames,
  type EventLogPage,
  type EventLogPageQuery,
  eventLogRowsLookedAtPerRequest,
} from '@bajaovrlay/shared';

// How many rows are read from the database at a time while looking for the rows of a
// filtered page. Large enough that an unfiltered page is one read, small enough that a
// filter matching little never holds much of the log in memory at once.
const rowsReadPerBatch = 500;

/**
 * One page of the history's older rows (GET /api/v1/event-log, BAJAOVRLAY-30): the rows
 * below `query.before` that pass the filters, newest first, `query.limit` of them at most;
 * whether rows below are still to be looked at; and if so `nextBefore`, where the next page
 * starts. A row is filtered on its pt-BR sentence, written with the names the slices hold
 * now (`names`), exactly as the page writes its live rows (describeEventLogEntry), so a
 * filter keeps the same rows on both.
 * What could go wrong: every row looked at gets its sentence written, synchronously, while
 * nothing else on the server runs. So one request looks at eventLogRowsLookedAtPerRequest
 * rows at most (gate 2 of PR #44) and answers what it found, short or empty, with
 * `nextBefore` at the row it stopped at; the page goes on from there.
 */
export function readFilteredEventLogPage(
  readEntriesBelow: (beforeId: number | undefined, limit: number) => EventLogEntry[],
  names: EventLogNames,
  query: EventLogPageQuery,
): EventLogPage {
  const filters = readFiltersOfQuery(query);
  const entriesOfThePage: EventLogEntry[] = [];
  // The id of the oldest row looked at so far; the rows below it are still to be looked at.
  let lookedAtDownTo = query.before;
  let rowsLookedAt = 0;

  while (rowsLookedAt < eventLogRowsLookedAtPerRequest) {
    const rowsToRead = Math.min(rowsReadPerBatch, eventLogRowsLookedAtPerRequest - rowsLookedAt);
    const batch = readEntriesBelow(lookedAtDownTo, rowsToRead);
    for (const entry of batch) {
      const described = describeEventLogEntry(entry, names);
      const doesItPass = doesEventLogEntryMatchFilters(described, filters);
      const isThePageFull = entriesOfThePage.length === query.limit;
      if (doesItPass && isThePageFull) {
        // One more row passes below a full page: the next page starts below its last row.
        const lastEntryOfThePage = entriesOfThePage[entriesOfThePage.length - 1];
        return { entries: entriesOfThePage, hasOlder: true, nextBefore: lastEntryOfThePage?.id };
      }
      if (doesItPass) {
        entriesOfThePage.push(entry);
      }
      rowsLookedAt += 1;
      lookedAtDownTo = entry.id;
    }
    const isTheEndOfTheLog = batch.length < rowsToRead;
    if (isTheEndOfTheLog) {
      return { entries: entriesOfThePage, hasOlder: false };
    }
  }

  // The cap is reached: answer what was found and where to go on, unless the row the
  // search stopped at was the first of the log.
  const isAnyRowLeftBelow = readEntriesBelow(lookedAtDownTo, 1).length > 0;
  if (!isAnyRowLeftBelow) {
    return { entries: entriesOfThePage, hasOlder: false };
  }
  return { entries: entriesOfThePage, hasOlder: true, nextBefore: lookedAtDownTo };
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
