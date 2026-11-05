import {
  type DescribedEventLogEntry,
  type EventLogEntry,
  type EventLogFilters,
  type EventLogNames,
  eventLogRowsSentLive,
} from '@bajaovrlay/shared';
import { useState } from 'react';

import { useServerState } from '@/state/ControlPageStateProvider';

import { fetchOlderEventLogPage } from './fetchOlderEventLogPage';
import { addEntriesHeardLive, findIdToLoadOlderRowsBelow, listHistoryRows } from './historyRows';

/** The older pages read for the filters shown: their rows, whether more lie below, how it went. */
type OlderPages = {
  filtersKey: string;
  entries: EventLogEntry[];
  /** What the last page said; undefined until one was read for these filters. */
  hasOlder: boolean | undefined;
  status: 'idle' | 'loading' | 'failed';
};

/** What the history page draws, and its one action. */
export type HistoryOfTheShow = {
  rows: DescribedEventLogEntry[];
  /** Whether "Carregar mais" is offered: the server may hold older rows for these filters. */
  canLoadOlderRows: boolean;
  isLoadingOlderRows: boolean;
  hasOlderPageFailed: boolean;
  /** "Carregar mais": the next 100 older rows that pass the filters, from the server. */
  loadOlderRows: () => void;
};

/**
 * The rows of the "Histórico" page (BAJAOVRLAY-30): the eventLog slice as it arrives, live,
 * at the top, and below it the older pages "Carregar mais" reads from GET /api/v1/event-log
 * with the same filters, run there on the server. Changing a filter drops the older pages
 * read for the filters before (they were filtered for those), and "Carregar mais" starts
 * again below the live rows. "Carregar mais" is offered until a page says there is nothing
 * older, and before any page only once the live slice is full (200 rows): with fewer, the
 * slice is the whole log.
 * The rows are the page's own view, like its filters: kept while the tab is open, lost on a
 * reload; nothing here is state of the show, which stays on the server.
 */
export function useHistoryOfTheShow(
  filters: EventLogFilters,
  names: EventLogNames,
): HistoryOfTheShow {
  const liveSlice = useServerState((state) => state.eventLog);
  const filtersKey = JSON.stringify(filters);

  // The live rows heard so far, the newest slice laid over them (historyRows.ts), worked
  // out while drawing whenever a new slice arrives, as React advises for state that
  // follows a value from outside.
  const [heardLive, setHeardLive] = useState({ liveSlice, entries: liveSlice });
  if (heardLive.liveSlice !== liveSlice) {
    setHeardLive({ liveSlice, entries: addEntriesHeardLive(heardLive.entries, liveSlice) });
  }

  const [olderPages, setOlderPages] = useState<OlderPages>(() => startOlderPagesFor(filtersKey));
  if (olderPages.filtersKey !== filtersKey) {
    setOlderPages(startOlderPagesFor(filtersKey));
  }

  function loadOlderRows(): void {
    const filtersKeyAsked = filtersKey;
    const beforeId = findIdToLoadOlderRowsBelow(heardLive.entries, olderPages.entries);
    setOlderPages((pages) => ({ ...pages, status: 'loading' }));
    void fetchOlderEventLogPage(beforeId, filters).then((outcome) => {
      setOlderPages((pages) => {
        // Filters changed while the page was on its way: it belongs to the old ones.
        if (pages.filtersKey !== filtersKeyAsked) {
          return pages;
        }
        if (!outcome.isFetched) {
          return { ...pages, status: 'failed' };
        }
        return {
          filtersKey: pages.filtersKey,
          entries: [...pages.entries, ...outcome.page.entries],
          hasOlder: outcome.page.hasOlder,
          status: 'idle',
        };
      });
    });
  }

  const rows = listHistoryRows({
    entriesHeardLive: heardLive.entries,
    olderEntries: olderPages.entries,
    names,
    filters,
  });
  const isLiveSliceFull = liveSlice.length >= eventLogRowsSentLive;
  return {
    rows,
    canLoadOlderRows: olderPages.hasOlder ?? isLiveSliceFull,
    isLoadingOlderRows: olderPages.status === 'loading',
    hasOlderPageFailed: olderPages.status === 'failed',
    loadOlderRows,
  };
}

/** No older page read yet for these filters. */
function startOlderPagesFor(filtersKey: string): OlderPages {
  return { filtersKey, entries: [], hasOlder: undefined, status: 'idle' };
}
