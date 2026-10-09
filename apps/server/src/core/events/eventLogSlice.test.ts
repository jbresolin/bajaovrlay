/**
 * The event-log slice (apps/server)
 *
 * What this module is for:
 *   The database keeps every event-log entry forever, but the `eventLog` slice that is
 *   held in memory and broadcast to every client keeps only the newest
 *   `eventLogSliceSize` (200) entries. Broadcasting the whole log would grow every
 *   message for the whole race day.
 *
 * What these tests prove:
 *   - Appending to a short log keeps every entry, oldest first.
 *   - Appending to a full log drops the oldest entry and keeps exactly 200.
 *
 * What these tests deliberately do not cover:
 *   - That the database still has every entry; storeRestart.test.ts proves that half.
 */
import type { EventLogEntry } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { appendToEventLogSlice, eventLogSliceSize } from './eventLogSlice.js';

/** Builds the event-log entry of a clearAll pressed by the operator, with the given id. */
function buildClearAllEntry(id: number): EventLogEntry {
  return {
    id,
    ts: '2026-10-09T14:32:05.000Z',
    actor: 'operador:conexao-7',
    command: 'clearAll',
    payload: { type: 'clearAll' },
    result: { status: 'ok' },
  };
}

/** Builds a log of the given number of entries, ids 1 to that number. */
function buildEventLogWithEntries(numberOfEntries: number): EventLogEntry[] {
  return Array.from({ length: numberOfEntries }, (_unused, index) => buildClearAllEntry(index + 1));
}

describe('appendToEventLogSlice', () => {
  it('keeps every entry of a short log, oldest first', () => {
    // Arrange: a log with two entries.
    const shortLog = buildEventLogWithEntries(2);

    // Act: append a third.
    const longerLog = appendToEventLogSlice(shortLog, buildClearAllEntry(3));

    // Assert: all three are there, in order.
    expect(
      longerLog.map((entry) => entry.id),
      'a short log must keep every entry in order',
    ).toEqual([1, 2, 3]);
  });

  it('drops the oldest entry of a full log and keeps exactly 200', () => {
    // Arrange: a log that is already full.
    const fullLog = buildEventLogWithEntries(eventLogSliceSize);

    // Act: append one more entry.
    const logAfterAppend = appendToEventLogSlice(fullLog, buildClearAllEntry(201));

    // Assert: still 200 entries, from id 2 to id 201.
    expect(eventLogSliceSize, 'the slice keeps the newest 200 entries').toBe(200);
    expect(logAfterAppend.length, 'the slice must never grow past its size').toBe(200);
    expect(logAfterAppend[0]?.id, 'the oldest entry (id 1) must be the one dropped').toBe(2);
    expect(logAfterAppend.at(-1)?.id, 'the new entry must be last').toBe(201);
  });
});
