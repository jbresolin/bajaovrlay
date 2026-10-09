/**
 * Renderer log lines (apps/renderer)
 *
 * What this module is for:
 *   The renderer runs inside OBS, where the only place to read what happened is the
 *   browser console (OBS's browser-source log or remote DevTools). rendererLog writes
 *   one JSON object per line there, so those lines can be searched and parsed like
 *   the server's logs.
 *
 * What these tests prove:
 *   - A log call writes exactly one line, and that line is JSON holding the level,
 *     the message, the time and any details passed along.
 *
 * What these tests deliberately do not cover:
 *   - That the renderer actually logs "renderer ready" when it starts; the Playwright
 *     test in e2e/ checks that in a real browser.
 */
import { describe, expect, it, vi } from 'vitest';

import { logRendererEvent } from './rendererLog.js';

describe('logRendererEvent', () => {
  it('writes one JSON line with level, message, time and details', () => {
    // Arrange: catch what would be written to the console, and fix the clock.
    const writtenLines: string[] = [];
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation((line: string) => {
      writtenLines.push(line);
    });
    const fixedNow = new Date('2026-05-16T14:30:00.000Z');

    // Act: log that the stage is ready, with its size as details.
    logRendererEvent('info', 'renderer ready', { stageWidth: 1920, stageHeight: 1080 }, fixedNow);
    consoleInfo.mockRestore();

    // Assert: exactly one line was written, and it parses back to the expected record.
    expect(writtenLines, 'one log call must write exactly one line').toHaveLength(1);
    expect(
      JSON.parse(writtenLines[0] ?? ''),
      'the line must be JSON with level, message, time and the details',
    ).toEqual({
      level: 'info',
      message: 'renderer ready',
      time: '2026-05-16T14:30:00.000Z',
      stageWidth: 1920,
      stageHeight: 1080,
    });
  });
});
