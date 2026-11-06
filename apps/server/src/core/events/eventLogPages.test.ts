/**
 * The filtered pages of the event log, past one read of the table (apps/server)
 *
 * What this module is for:
 *   GET /api/v1/event-log hands the history page (BAJAOVRLAY-30) its older rows a page at a
 *   time, with the page's filters. readFilteredEventLogPage reads the table in batches of
 *   500 rows, newest first, and keeps the rows whose pt-BR sentence passes the filters, so
 *   a filter that matches few rows has to read on, batch after batch, to fill a page.
 *
 * What these tests prove (on logs of 600 to 5,600 rows held in memory, read as SQLite would):
 *   - A sparse filter whose page needs a second batch: two pages that each follow `before`
 *     give every matching row once, in order, and `hasOlder` is right on both (gate 2 of
 *     PR #44: reading on past the first batch is what a missing cursor step would break).
 *   - One request looks at 5,000 rows at most (gate 2 of PR #44): a filter that finds
 *     nothing, or less than a page, answers what it found, `hasOlder`, and `nextBefore`,
 *     the row id it stopped at; the next request, below it, finds the rest. `hasOlder` is
 *     false when the cap ends at the first row of the log.
 *
 * What these tests deliberately do not cover:
 *   - The route around it (its query, its access, a real SQLite file);
 *     apps/server/src/api/v1/eventLogRoute.test.ts.
 *   - Which rows each filter keeps; packages/shared's eventLogFilters.test.ts.
 */
import type { EventLogEntry } from '@bajaovrlay/shared';
import { buildEventLogNamesOfRaceDay } from '@bajaovrlay/shared/eventLogNamesOfRaceDay.testSupport';
import { describe, expect, it } from 'vitest';

import { readFilteredEventLogPage } from './eventLogPages.js';

/**
 * A morning's log of `numberOfRows` rows, ids 1 upwards, one a second from 08:00: the
 * operator moving the rundown's cursor, except the rows of `refusedRowIds`, each a take of
 * a deleted item, refused. So "Só recusas" keeps exactly those rows.
 */
function buildMorningLogWithRefusalsAt(
  numberOfRows: number,
  refusedRowIds: number[],
): EventLogEntry[] {
  const morningStartMs = Date.parse('2026-11-05T08:00:00.000Z');
  return Array.from({ length: numberOfRows }, (_unused, index): EventLogEntry => {
    const id = index + 1;
    const ts = new Date(morningStartMs + index * 1_000).toISOString();
    if (refusedRowIds.includes(id)) {
      return {
        id,
        ts,
        actor: 'operador:conexao-7',
        command: 'takeItem',
        payload: { type: 'takeItem', itemId: 'item-tarja-apagada' },
        result: {
          status: 'failed',
          error: { code: 'ITEM_NOT_FOUND', message: 'O item "item-tarja-apagada" não existe.' },
        },
      };
    }
    return {
      id,
      ts,
      actor: 'operador:conexao-7',
      command: 'moveCursor',
      payload: { type: 'moveCursor', rundownId: 'sessao-principal', itemId: null },
      result: { status: 'ok' },
    };
  });
}

/** A morning's log of `numberOfRows` rows with a refusal every fifty rows (50, 100, …). */
function buildMorningLogWithARefusalEveryFiftyRows(numberOfRows: number): EventLogEntry[] {
  const everyFiftiethId = Array.from(
    { length: Math.floor(numberOfRows / 50) },
    (_unused, index) => (index + 1) * 50,
  );
  return buildMorningLogWithRefusalsAt(numberOfRows, everyFiftiethId);
}

/**
 * Reads the log as the store reads the event_log table: the rows below `beforeId` (all of
 * them when undefined), newest first, `limit` at most.
 */
function readLogAsTheTableWould(log: EventLogEntry[]) {
  return (beforeId: number | undefined, limit: number): EventLogEntry[] => {
    const rowsBelow = log.filter((entry) => beforeId === undefined || entry.id < beforeId);
    return rowsBelow.reverse().slice(0, limit);
  };
}

describe('a filtered page that needs more than one read of the table', () => {
  it('gives every matching row once, in order, over two pages that follow `before`', () => {
    // Arrange: 600 rows with a refusal at ids 50, 100, … 600 (twelve), and the filter "Só
    // recusas" with pages of ten. The first read holds rows 600 to 101, so the eleventh
    // refusal (row 100), which says there is more, is only found in the second read.
    const log = buildMorningLogWithARefusalEveryFiftyRows(600);
    const readEntriesBelow = readLogAsTheTableWould(log);
    const names = buildEventLogNamesOfRaceDay();

    // Act: read the first page, then the page below its last row.
    const firstPage = readFilteredEventLogPage(readEntriesBelow, names, {
      limit: 10,
      onlyRefusals: true,
    });
    const secondPage = readFilteredEventLogPage(readEntriesBelow, names, {
      limit: 10,
      onlyRefusals: true,
      before: firstPage.entries.at(-1)?.id,
    });

    // Assert: twelve refusals, newest first, none missing and none twice; more after the
    // first page, nothing after the second.
    const idsReadInTurn = [...firstPage.entries, ...secondPage.entries].map((entry) => entry.id);
    expect(idsReadInTurn, 'every refusal once, newest first, across both pages').toEqual([
      600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100, 50,
    ]);
    expect(firstPage.hasOlder, 'a refusal lies below the first page, in the second read').toBe(
      true,
    );
    expect(secondPage.hasOlder, 'nothing lies below the second page').toBe(false);
  });
});

describe('the most rows one request looks at', () => {
  const cappedSearchScenarios = [
    // A text typed in a hurry that no sentence holds, on a long morning: the request stops
    // after 5,000 rows instead of describing the whole table, and says where to go on.
    {
      name: 'stops after 5,000 rows with nothing found, and says where to go on from',
      log: buildMorningLogWithRefusalsAt(5_600, []),
      filters: { text: 'bandeira vermelha' },
      expectedIds: [],
      expectedHasOlder: true,
      expectedNextBefore: 601,
    },
    // The same search on a log of exactly 5,000 rows: the cap is reached at the very first
    // row, so nothing is left below, and the page must not offer more.
    {
      name: 'says there is nothing older when the cap ends at the first row of the log',
      log: buildMorningLogWithRefusalsAt(5_000, []),
      filters: { text: 'bandeira vermelha' },
      expectedIds: [],
      expectedHasOlder: false,
      expectedNextBefore: undefined,
    },
    // Only two refusals, one near the top and one near the bottom: the first is answered
    // within the cap, short of a full page, and the search goes on from the cap.
    {
      name: 'answers the rows found within the cap, short of a full page',
      log: buildMorningLogWithRefusalsAt(5_600, [5_590, 10]),
      filters: { onlyRefusals: true },
      expectedIds: [5_590],
      expectedHasOlder: true,
      expectedNextBefore: 601,
    },
    // A filter that fills its page early: the next page starts below the page's last row.
    {
      name: 'says to go on below the last row of a full page',
      log: buildMorningLogWithARefusalEveryFiftyRows(600),
      filters: { onlyRefusals: true },
      expectedIds: [600, 550, 500, 450, 400, 350, 300, 250, 200, 150],
      expectedHasOlder: true,
      expectedNextBefore: 150,
    },
  ];

  it.each(cappedSearchScenarios)(
    '$name',
    ({ log, filters, expectedIds, expectedHasOlder, expectedNextBefore }) => {
      // Arrange: the log, read as the table would be.
      const readEntriesBelow = readLogAsTheTableWould(log);

      // Act: read one page of ten from the newest row.
      const page = readFilteredEventLogPage(readEntriesBelow, buildEventLogNamesOfRaceDay(), {
        limit: 10,
        ...filters,
      });

      // Assert: the rows found, whether more may lie below, and where to go on from.
      expect(
        page.entries.map((entry) => entry.id),
        'the rows that pass the filter within the cap',
      ).toEqual(expectedIds);
      expect(page.hasOlder, 'whether rows below are still to be looked at').toBe(expectedHasOlder);
      expect(page.nextBefore, 'the row id the next request starts below').toBe(expectedNextBefore);
    },
  );

  it('finds the rest by going on from where the capped request stopped', () => {
    // Arrange: the long morning with two refusals, and the first page, which stopped at
    // the cap with row 5,590.
    const readEntriesBelow = readLogAsTheTableWould(
      buildMorningLogWithRefusalsAt(5_600, [5_590, 10]),
    );
    const names = buildEventLogNamesOfRaceDay();
    const firstPage = readFilteredEventLogPage(readEntriesBelow, names, {
      limit: 10,
      onlyRefusals: true,
    });

    // Act: ask for the next page below where it stopped.
    const secondPage = readFilteredEventLogPage(readEntriesBelow, names, {
      limit: 10,
      onlyRefusals: true,
      before: firstPage.nextBefore,
    });

    // Assert: the refusal at row 10, and nothing below it.
    expect(
      secondPage.entries.map((entry) => entry.id),
      'the second request must find the refusal the first did not reach',
    ).toEqual([10]);
    expect(secondPage.hasOlder, 'nothing is left below row 10').toBe(false);
  });
});
