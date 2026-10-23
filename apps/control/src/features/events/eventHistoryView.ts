/**
 * The history of the "Eventos" page as the operator chose to see it: the rows found by
 * what was typed in "Buscar no histórico", in the order of the header clicked (asked at
 * the walk of PR #22). Pure, so each rule is tested without a page; the search and the
 * sort are the page's own view and never reach the server.
 */
import type { DataSource, InboxEvent } from '@bajaovrlay/shared';

import { formatTimeOfDay } from '@/features/dataSources/timeOfDayText';
import { ptBR } from '@/i18n/ptBR';
import { writeTextForSearch } from '@/i18n/textForSearch';

import {
  describeDetailsOfEvent,
  describeKindOfEvent,
  describeOriginOfEvent,
} from './inboxEventText';

/** The columns the history can be sorted by; "Detalhes" and "Ações" cannot. */
export type HistorySortColumn = 'time' | 'kind' | 'car' | 'team' | 'lap' | 'origin' | 'status';

/** Which column the history is sorted by, and which way. */
export type HistorySort = {
  column: HistorySortColumn;
  direction: 'ascending' | 'descending';
};

/** The order before any click: newest first. */
export const newestFirstSort: HistorySort = { column: 'time', direction: 'descending' };

/** One row of the history: its event, and each cell as the table writes it. */
export type HistoryRow = {
  event: InboxEvent;
  cells: {
    time: string;
    kind: string;
    car: string;
    team: string;
    lap: string;
    details: string;
    origin: string;
    status: string;
  };
};

// Built once: pt-BR order of words ("Acauã" before "Carnaúba"), as Cadastros sorts names.
const wordOrder = new Intl.Collator('pt-BR');

/** The row of one event, each cell written as the table shows it. */
function buildHistoryRow(event: InboxEvent, dataSources: DataSource[]): HistoryRow {
  const { payload } = event;
  return {
    event,
    cells: {
      time: formatTimeOfDay(event.detectedAtMs),
      kind: describeKindOfEvent(event),
      car: String(payload.carNumber),
      team: payload.teamName ?? '',
      lap: payload.lapNumber === undefined ? '' : String(payload.lapNumber),
      details: describeDetailsOfEvent(event),
      origin: describeOriginOfEvent(event, dataSources),
      status: ptBR.events.statusWords[event.status],
    },
  };
}

/**
 * Whether a row is found by the search: a number alone is a car, found whole ("4" finds
 * neither car 47 nor lap 34, as in Cadastros); any other text is found in any cell,
 * without regard to case or accents. An empty search finds every row.
 */
function isRowFoundBySearch(row: HistoryRow, query: string): boolean {
  if (query === '') {
    return true;
  }
  const isCarNumber = /^\d+$/.test(query);
  if (isCarNumber) {
    return row.cells.car === query;
  }
  return Object.values(row.cells).some((cellText) => writeTextForSearch(cellText).includes(query));
}

/**
 * How two rows compare on a column, smallest or A first: moments and numbers as numbers,
 * words in pt-BR order. Negative when `first` comes first. The lap is compared only when
 * both have one; listHistoryRows puts a missing lap last before calling this.
 */
function compareRowsAscending(
  column: HistorySortColumn,
  first: HistoryRow,
  second: HistoryRow,
): number {
  switch (column) {
    case 'time':
      return first.event.detectedAtMs - second.event.detectedAtMs;
    case 'car':
      return first.event.payload.carNumber - second.event.payload.carNumber;
    case 'lap':
      return (first.event.payload.lapNumber ?? 0) - (second.event.payload.lapNumber ?? 0);
    case 'kind':
    case 'team':
    case 'origin':
    case 'status':
      return wordOrder.compare(first.cells[column], second.cells[column]);
  }
}

/**
 * The rows of the history: every event the server keeps, those the search finds, in the
 * chosen order. An event without a lap goes last when sorting by lap, either way; rows
 * equal on the column keep newest first.
 */
export function listHistoryRows(
  events: InboxEvent[],
  dataSources: DataSource[],
  view: { searchText: string; sort: HistorySort },
): HistoryRow[] {
  const query = writeTextForSearch(view.searchText);
  const rowsFound = events
    .map((event) => buildHistoryRow(event, dataSources))
    .filter((row) => isRowFoundBySearch(row, query));
  const { column, direction } = view.sort;

  return rowsFound.sort((first, second) => {
    if (column === 'lap') {
      const isFirstWithoutLap = first.event.payload.lapNumber === undefined;
      const isSecondWithoutLap = second.event.payload.lapNumber === undefined;
      if (isFirstWithoutLap !== isSecondWithoutLap) {
        return isFirstWithoutLap ? 1 : -1;
      }
    }
    const ascendingOrder = compareRowsAscending(column, first, second);
    const chosenOrder = direction === 'ascending' ? ascendingOrder : -ascendingOrder;
    if (chosenOrder !== 0) {
      return chosenOrder;
    }
    const newestFirstOrder = second.event.detectedAtMs - first.event.detectedAtMs;
    return newestFirstOrder;
  });
}

/**
 * The sort after a click on a column's header: the same column flips; another starts
 * ascending, except the time, which starts newest first.
 */
export function chooseHistorySortAfterClickOn(
  sortBefore: HistorySort,
  clickedColumn: HistorySortColumn,
): HistorySort {
  if (sortBefore.column === clickedColumn) {
    const flippedDirection = sortBefore.direction === 'ascending' ? 'descending' : 'ascending';
    return { column: clickedColumn, direction: flippedDirection };
  }
  if (clickedColumn === 'time') {
    return newestFirstSort;
  }
  return { column: clickedColumn, direction: 'ascending' };
}
