/**
 * Data for the preview page (packages/graphics/race-clock)
 *
 * What this module is for:
 *   preview.html shows the race clock on its own, for designers, for the screenshot
 *   tests and later for the control page. It takes its data from `?data=<JSON>` in the
 *   address, or shows a running enduro sample when there is none.
 *
 * What these tests prove:
 *   - Without `?data=`, the sample is a running green-flag enduro whose reading is
 *     "now", so the clock visibly runs from 1:05:00.
 *   - With `?data=`, the JSON in the address is used exactly as written.
 *   - JSON that cannot be read gives a pt-BR problem to show, not an exception.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid race clock data; the graphic's own `load` decides that
 *     (raceClockModel.test.ts), so the preview shows the same answer a renderer gets.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData } from './previewData.js';

/** 16 May 2026, 14:30:00 UTC: "now" in these tests. */
const nowWallClockMs = Date.parse('2026-05-16T14:30:00.000Z');

describe('choosePreviewData', () => {
  it('uses a running green-flag enduro read "now" when the address has no data', () => {
    // Arrange: the address of the preview page with no query at all.
    const addressQuery = '';

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery, nowWallClockMs);

    // Assert: the sample enduro, running from 1:05:00 as of now.
    expect(choice, 'with no ?data= the preview must show the running enduro sample').toEqual({
      isReadable: true,
      data: {
        sessionName: 'Enduro de Resistência',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 3_900_000,
        referenceWallClockMs: nowWallClockMs,
        running: true,
        lapsCompletedByLeader: 12,
      },
    });
  });

  it('uses the JSON from ?data= exactly as written', () => {
    // Arrange: a held red-flag reading, encoded into the address as the tests do.
    const redFlagData = {
      sessionName: 'Enduro de Resistência',
      state: 'red',
      clockMode: 'elapsed',
      referenceTimeMs: 4_210_000,
      referenceWallClockMs: 0,
      running: false,
    };
    const addressQuery = `?data=${encodeURIComponent(JSON.stringify(redFlagData))}`;

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery, nowWallClockMs);

    // Assert: the data is the address JSON, untouched.
    expect(choice, 'the ?data= JSON must be used exactly as written').toEqual({
      isReadable: true,
      data: redFlagData,
    });
  });

  it('gives a pt-BR problem instead of throwing when ?data= is not JSON', () => {
    // Arrange: an address whose data was cut off while being copied.
    const addressQuery = '?data=%7B%22state%22%3A%22gre';

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery, nowWallClockMs);

    // Assert: a pt-BR problem the page can show.
    expect(choice, 'unreadable ?data= must produce a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
