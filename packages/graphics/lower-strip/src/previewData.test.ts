/**
 * The preview page's data (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   preview.html shows the strip as the design's lower-strip page does: the real enduro's
 *   34 cars, the clock an hour in under the green flag, the clock block on. The address
 *   switches the block off (`?clock=off`) or gives the data itself (`?data=<JSON>`); on a
 *   screenshot stage (`?stage=`) the clock is held, so a baseline never depends on time.
 *
 * What these tests prove:
 *   - Without a query: the 34 cars, green, 1:00:00 counting from the moment the page
 *     opened, the block on.
 *   - `?clock=off` switches the block off; `?stage=grey` holds the clock.
 *   - `?data=` hands its JSON over as it is; JSON that cannot be read is a pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid; the graphic's own load() answers that.
 *   - The page's buttons; e2e/lowerStripLifecycle.e2e.ts presses them in Chromium.
 */
import { describe, expect, it } from 'vitest';

import type { LowerStripData } from './lowerStripModel.js';
import { choosePreviewData } from './previewData.js';

// The moment the preview page opened, on the enduro's day.
const pageOpenedAtMs = Date.UTC(2026, 2, 8, 17, 0, 0);

/** Reads the data a query gives, failing the test when it cannot be read. */
function readSampleOfQuery(query: string): LowerStripData {
  const choice = choosePreviewData(query, pageOpenedAtMs);
  if (!choice.isReadable) {
    throw new Error(`the query ${query} should give readable data`);
  }
  return choice.data as LowerStripData;
}

describe('choosePreviewData', () => {
  it('shows the real 34 cars an hour in, the clock running from the page’s opening', () => {
    // Arrange: an address with no query.

    // Act: choose the data.
    const data = readSampleOfQuery('');

    // Assert: the field, the clock and the block.
    expect(data.entries, 'the real field').toHaveLength(34);
    expect(
      {
        state: data.state,
        clockMode: data.clockMode,
        referenceTimeMs: data.referenceTimeMs,
        referenceWallClockMs: data.referenceWallClockMs,
        running: data.running,
        showClockBlock: data.showClockBlock,
      },
      'green, 1:00:00 counting up from the opening, the block on',
    ).toEqual({
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 3_600_000,
      referenceWallClockMs: pageOpenedAtMs,
      running: true,
      showClockBlock: true,
    });
  });

  it('switches the block off with ?clock=off and holds the clock on a screenshot stage', () => {
    // Arrange: the two switches.

    // Act: choose the data for each.
    const withoutTheBlock = readSampleOfQuery('?clock=off');
    const onTheGreyStage = readSampleOfQuery('?stage=grey');

    // Assert: the block off; the clock held for the baseline.
    expect(withoutTheBlock.showClockBlock, 'the block is off').toBe(false);
    expect(onTheGreyStage.running, 'a screenshot stage holds the clock').toBe(false);
  });

  it('hands the JSON of ?data= over as it is, and says in pt-BR when it cannot be read', () => {
    // Arrange: two cars written into the address, and an address cut short.
    const twoCars = { entries: [{ position: 1, carNumber: 51, schoolName: 'FAHOR' }] };
    const goodQuery = `?data=${encodeURIComponent(JSON.stringify(twoCars))}`;

    // Act: choose the data for both.
    const goodChoice = choosePreviewData(goodQuery, pageOpenedAtMs);
    const brokenChoice = choosePreviewData('?data=%7B%22entries%22', pageOpenedAtMs);

    // Assert: the data unchanged; the broken one a pt-BR problem.
    expect(goodChoice, 'the data must be handed over unchanged').toEqual({
      isReadable: true,
      data: twoCars,
    });
    expect(brokenChoice, 'unreadable data must be a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
