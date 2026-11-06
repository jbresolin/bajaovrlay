/**
 * The filtered pages of the event log, past one read of the table (apps/server)
 *
 * What this module is for:
 *   GET /api/v1/event-log hands the history page (BAJAOVRLAY-30) its older rows a page at a
 *   time, with the page's filters. readFilteredEventLogPage reads the table in batches of
 *   500 rows, newest first, and keeps the rows whose pt-BR sentence passes the filters, so
 *   a filter that matches few rows has to read on, batch after batch, to fill a page.
 *
 * What these tests prove (on a log of 600 rows held in memory, read as SQLite would):
 *   - A sparse filter whose page needs a second batch: two pages that each follow `before`
 *     give every matching row once, in order, and `hasOlder` is right on both (gate 2 of
 *     PR #44: reading on past the first batch is what a missing cursor step would break).
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
 * operator moving the rundown's cursor, and every fiftieth row a take of a deleted item,
 * refused. So "Só recusas" keeps one row in fifty.
 */
function buildMorningLogWithARefusalEveryFiftyRows(numberOfRows: number): EventLogEntry[] {
  const morningStartMs = Date.parse('2026-11-05T08:00:00.000Z');
  return Array.from({ length: numberOfRows }, (_unused, index): EventLogEntry => {
    const id = index + 1;
    const ts = new Date(morningStartMs + index * 1_000).toISOString();
    if (id % 50 === 0) {
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
