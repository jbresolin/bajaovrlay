/**
 * Searching and sorting the history of the "Eventos" page (apps/control)
 *
 * What this module is for:
 *   The history lists up to 200 events. During a race the operator looks for one car's
 *   penalties, or wants the penalties together, so the table can be searched and sorted
 *   (asked at the walk of PR #22). eventHistoryView.ts is the pure part: from the events
 *   and what the operator typed and chose, the rows in the order to draw them.
 *
 * What these tests prove:
 *   - With nothing typed and no column chosen, every event is listed newest first.
 *   - A search finds text in any cell, without regard to case or accents; a number alone
 *     finds that car exactly; a search that finds nothing lists nothing.
 *   - Each sortable column sorts its own way (moments, pt-BR words, numbers), both ways,
 *     an event without a lap last either way, and ties newest first.
 *   - Choosing a column starts it ascending (the time descending); choosing it again flips.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the table, the box and the headers; EventHistorySearchAndSort.test.tsx.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildSimulatorThatIsOk } from '@/state/dataSourcesLikeTheServerSends.testSupport';
import {
  buildFinishedLeaderChangeOfCar52,
  buildPendingPenaltyOfCar47,
  buildPendingWarningOfCar38,
  buildQueuedFastestLapOfCar31,
  buildShownManualNoticeOfCar12,
} from '@/state/eventsLikeTheServerSends.testSupport';

import {
  chooseHistorySortAfterClickOn,
  type HistorySort,
  listHistoryRows,
  newestFirstSort,
} from './eventHistoryView';

/**
 * Five events of the enduro, arrival order: the typed notice of car 12 (40 min ago), the
 * leader change of car 52 (30), the penalty of car 47 (5), the warning of car 38 (3), the
 * fastest lap of car 31 (1).
 */
function buildFiveEventsOfTheEnduro(): InboxEvent[] {
  return [
    buildShownManualNoticeOfCar12(40),
    buildFinishedLeaderChangeOfCar52(30, 'dismissed'),
    buildPendingPenaltyOfCar47(5),
    buildPendingWarningOfCar38(3),
    buildQueuedFastestLapOfCar31(1),
  ];
}

/** The car numbers of the rows listed for this search and sort, top to bottom. */
function listCarsOfRows(searchText: string, sort: HistorySort): Array<number | undefined> {
  const rows = listHistoryRows(buildFiveEventsOfTheEnduro(), [buildSimulatorThatIsOk()], {
    searchText,
    sort,
  });
  return rows.map((row) => row.event.payload.carNumber);
}

describe('the history with nothing chosen', () => {
  it('lists every event newest first', () => {
    // Arrange: nothing typed, the default sort.
    const sort = newestFirstSort;

    // Act: list the rows.
    const cars = listCarsOfRows('', sort);

    // Assert: the fastest lap of car 31 first, the typed notice of car 12 last.
    expect(cars, 'newest first').toEqual([31, 38, 47, 52, 12]);
  });
});

describe('searching the history', () => {
  const searchScenarios = [
    // A team's name, typed without its accent and in lower case.
    { name: 'finds a team without accents', searchText: 'carnauba', expectedCars: [47] },
    // A word of a reason ("Bloqueio de ultrapassagem").
    { name: 'finds a word of the reason', searchText: 'ULTRAPASSAGEM', expectedCars: [38] },
    // What the event is, as the table writes it.
    { name: 'finds the kind', searchText: 'volta mais', expectedCars: [31] },
    // Where it came from: the typed one says "Digitado".
    { name: 'finds the origin', searchText: 'digitado', expectedCars: [12] },
    // Its status word.
    { name: 'finds the status', searchText: 'descartado', expectedCars: [52] },
    // A number alone is a car, whole: "4" finds no car 47 and no lap 34.
    { name: 'finds a car by its whole number', searchText: '47', expectedCars: [47] },
    { name: 'finds no car by part of its number', searchText: '4', expectedCars: [] },
    // Nothing matches: the table is empty, not the whole list.
    { name: 'lists nothing when nothing matches', searchText: 'capotamento', expectedCars: [] },
  ];

  it.each(searchScenarios)('$name', ({ searchText, expectedCars }) => {
    // Arrange: the five events, newest first.

    // Act: search for this row's text.
    const cars = listCarsOfRows(searchText, newestFirstSort);

    // Assert: the cars of the events found.
    expect(cars, `"${searchText}" must find these cars`).toEqual(expectedCars);
  });
});

describe('sorting the history', () => {
  const sortScenarios = [
    // Oldest first: the reverse of the default.
    {
      name: 'by time, oldest first',
      sort: { column: 'time', direction: 'ascending' },
      expectedCars: [12, 52, 47, 38, 31],
    },
    // pt-BR words: Advertência, Aviso, Mudança de líder, Penalidade, Volta mais rápida.
    {
      name: 'by kind, A to Z',
      sort: { column: 'kind', direction: 'ascending' },
      expectedCars: [38, 12, 52, 47, 31],
    },
    // Car numbers compared as numbers, both ways (as text, a car 7 would follow 52).
    {
      name: 'by car, smallest first',
      sort: { column: 'car', direction: 'ascending' },
      expectedCars: [12, 31, 38, 47, 52],
    },
    {
      name: 'by car, largest first',
      sort: { column: 'car', direction: 'descending' },
      expectedCars: [52, 47, 38, 31, 12],
    },
    // Acauã, Carnaúba, Coruja, Pequi, Tatu: the accent does not move Acauã.
    {
      name: 'by team, A to Z',
      sort: { column: 'team', direction: 'ascending' },
      expectedCars: [31, 47, 38, 52, 12],
    },
    // Laps 1, 20, 34; the warning and the notice have none, so they come last, newest
    // first among themselves.
    {
      name: 'by lap, smallest first, no lap last',
      sort: { column: 'lap', direction: 'ascending' },
      expectedCars: [47, 52, 31, 38, 12],
    },
    {
      name: 'by lap, largest first, no lap still last',
      sort: { column: 'lap', direction: 'descending' },
      expectedCars: [31, 52, 47, 38, 12],
    },
    // "Digitado" before "Simulador — Enduro"; the four of the simulator newest first.
    {
      name: 'by origin, ties newest first',
      sort: { column: 'origin', direction: 'ascending' },
      expectedCars: [12, 31, 38, 47, 52],
    },
    // descartado, esperando (47 and 38, newest first), exibido, na fila.
    {
      name: 'by status, A to Z',
      sort: { column: 'status', direction: 'ascending' },
      expectedCars: [52, 38, 47, 12, 31],
    },
  ] as const;

  it.each(sortScenarios)('$name', ({ sort, expectedCars }) => {
    // Arrange: the five events, nothing typed.

    // Act: sort by this row's column and direction.
    const cars = listCarsOfRows('', sort);

    // Assert: the cars in this order.
    expect(cars, `sorted ${sort.column} ${sort.direction}`).toEqual(expectedCars);
  });
});

describe('choosing a column to sort by', () => {
  const clickScenarios = [
    // A new column starts A to Z, smallest first.
    {
      name: 'starts a new column ascending',
      before: newestFirstSort,
      clickedColumn: 'car',
      expected: { column: 'car', direction: 'ascending' },
    },
    // The time starts newest first: what the operator looks for.
    {
      name: 'starts the time descending',
      before: { column: 'car', direction: 'ascending' },
      clickedColumn: 'time',
      expected: { column: 'time', direction: 'descending' },
    },
    // The same column again flips the order.
    {
      name: 'flips the column already chosen',
      before: { column: 'car', direction: 'ascending' },
      clickedColumn: 'car',
      expected: { column: 'car', direction: 'descending' },
    },
  ] as const;

  it.each(clickScenarios)('$name', ({ before, clickedColumn, expected }) => {
    // Arrange: the sort before the click, from this row.

    // Act: click the column's header.
    const sortAfter = chooseHistorySortAfterClickOn(before, clickedColumn);

    // Assert: the sort this row expects.
    expect(sortAfter, `a click on ${clickedColumn}`).toEqual(expected);
  });
});
