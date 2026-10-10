/**
 * Control page log lines (apps/control)
 *
 * What this module is for:
 *   When the control page meets something odd (a message from the server it cannot
 *   read, an answer nobody was waiting for) it does not bother the operator; it writes
 *   one JSON line to the browser console, shaped like the server's and the renderer's
 *   log lines, for whoever investigates later with DevTools open.
 *
 * What these tests prove:
 *   - A log call writes exactly one line, and that line is JSON holding the level,
 *     the message, the time and any details passed along.
 *
 * What these tests deliberately do not cover:
 *   - Which events get logged; serverConnection.test.ts covers those.
 */
import { describe, expect, it, vi } from 'vitest';

import { logControlEvent } from './controlLog';

describe('logControlEvent', () => {
  it('writes one JSON line with level, message, time and details', () => {
    // Arrange: catch what would be written to the console, and fix the clock.
    const writtenLines: string[] = [];
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation((line: string) => {
      writtenLines.push(line);
    });
    const fixedNow = new Date('2026-10-10T13:00:00.000Z');

    // Act: log a late answer from the server, with its request id as details.
    logControlEvent(
      'warn',
      'ignored a command result nobody is waiting for',
      { request_id: 'pedido-17' },
      fixedNow,
    );
    consoleInfo.mockRestore();

    // Assert: exactly one line was written, and it parses back to the expected record.
    expect(writtenLines, 'one log call must write exactly one line').toHaveLength(1);
    expect(
      JSON.parse(writtenLines[0] ?? ''),
      'the line must be JSON with level, message, time and the details',
    ).toEqual({
      level: 'warn',
      message: 'ignored a command result nobody is waiting for',
      time: '2026-10-10T13:00:00.000Z',
      request_id: 'pedido-17',
    });
  });
});
