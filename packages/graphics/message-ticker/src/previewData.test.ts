/**
 * The preview page's data (packages/graphics/message-ticker)
 *
 * What this module is for:
 *   preview.html shows the ticker as the design's message-ticker page does: "AVISO" and
 *   the enduro's three announcements, the clock an hour in, the block on. The address
 *   switches the block off (`?clock=off`), keeps one message (`?messages=1`) or gives the
 *   data itself (`?data=<JSON>`); on a screenshot stage the clock is held.
 *
 * What these tests prove:
 *   - Without a query: the three announcements, "AVISO", the clock running, the block on.
 *   - `?clock=off&messages=1&stage=grey`: no block, one message, the clock held.
 *   - `?data=` hands its JSON over as it is; JSON that cannot be read is a pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid; the graphic's own load() answers that.
 */
import { describe, expect, it } from 'vitest';

import type { MessageTickerData } from './messageTickerModel.js';
import { choosePreviewData } from './previewData.js';

// The moment the preview page opened, on the enduro's day.
const pageOpenedAtMs = Date.UTC(2026, 2, 8, 17, 0, 0);

describe('choosePreviewData', () => {
  it('shows the design’s ticker when the address says nothing', () => {
    // Arrange: an address with no query.

    // Act: choose the data.
    const choice = choosePreviewData('', pageOpenedAtMs);

    // Assert: the label, the three announcements, the running clock, the block on.
    const data = (choice as { data: MessageTickerData }).data;
    expect(
      [data.label, data.messages.length, data.running, data.showClockBlock],
      'the design’s ticker',
    ).toEqual(['AVISO', 3, true, true]);
  });

  it('switches the block off, keeps one message and holds the clock on a stage', () => {
    // Arrange: the three switches together.

    // Act: choose the data.
    const choice = choosePreviewData('?clock=off&messages=1&stage=grey', pageOpenedAtMs);

    // Assert: each switch applied.
    const data = (choice as { data: MessageTickerData }).data;
    expect(
      [data.showClockBlock, data.messages, data.running],
      'no block, one message, the clock held',
    ).toEqual([false, ['Largada do enduro às 10h00'], false]);
  });

  it('hands ?data= over as it is, and says in pt-BR when it cannot be read', () => {
    // Arrange: a label written into the address, and an address cut short.
    const query = `?data=${encodeURIComponent(JSON.stringify({ label: 'ATENÇÃO' }))}`;

    // Act: choose the data for both.
    const goodChoice = choosePreviewData(query, pageOpenedAtMs);
    const brokenChoice = choosePreviewData('?data=%7B%22label%22', pageOpenedAtMs);

    // Assert: unchanged; a pt-BR problem.
    expect(goodChoice, 'the data unchanged').toEqual({
      isReadable: true,
      data: { label: 'ATENÇÃO' },
    });
    expect(brokenChoice, 'a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
