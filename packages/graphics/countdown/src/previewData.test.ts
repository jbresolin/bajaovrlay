/**
 * What the countdown's preview page loads (packages/graphics/countdown)
 *
 * What this module is for:
 *   preview.html shows the design's sample (the enduro, 23:45 from now) as the card or,
 *   with `?layout=fullscreen`, the waiting board; `?data=<JSON>` replaces it with any data,
 *   which the graphic's own load then judges.
 *
 * What these tests prove:
 *   - With no data in the address the sample is the card, its start 23:45 after "now".
 *   - `?layout=fullscreen` gives the waiting board, with the event and date lines.
 *   - `?data=` is read as JSON as it is; text that is not JSON gives the pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - The page's buttons; the e2e tests drive the built preview.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData } from './previewData.js';

/** 09:36:15 on Sunday 30 March 2025 in Brasília: "now" for these tests. */
const nowMs = Date.parse('2025-03-30T09:36:15.000-03:00');

describe('choosePreviewData', () => {
  it('gives the enduro’s card, 23:45 before its start, with no data in the address', () => {
    // Arrange: an address with no query.

    // Act: choose the data.
    const choice = choosePreviewData('', nowMs);

    // Assert: the card, starting at 10:00.
    expect(choice, 'the design’s sample').toEqual({
      isReadable: true,
      data: {
        layout: 'card',
        sessionName: 'Enduro de Resistência',
        startsAtMs: Date.parse('2025-03-30T10:00:00.000-03:00'),
        eventLine: '30ª Competição Baja SAE Brasil',
        dateLine: 'domingo, 30 de março de 2025',
      },
    });
  });

  it('gives the waiting board with ?layout=fullscreen', () => {
    // Arrange: the address of the full screen.

    // Act: choose the data.
    const choice = choosePreviewData('?layout=fullscreen', nowMs);

    // Assert: the board's layout.
    const data = choice.isReadable ? (choice.data as { layout: string }) : undefined;
    expect(data?.layout, 'the waiting board').toBe('fullscreen');
  });

  it('reads ?data= as JSON, and says when it is not', () => {
    // Arrange: one address with JSON, one with a broken text.
    const goodAddress = `?data=${encodeURIComponent('{"layout":"card"}')}`;

    // Act: choose the data for both.
    const goodChoice = choosePreviewData(goodAddress, nowMs);
    const badChoice = choosePreviewData('?data=%7Bquebrado', nowMs);

    // Assert: the JSON as it is, and the pt-BR problem.
    expect(goodChoice, 'the JSON is passed on as it is').toEqual({
      isReadable: true,
      data: { layout: 'card' },
    });
    expect(badChoice, 'a broken text says why').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
