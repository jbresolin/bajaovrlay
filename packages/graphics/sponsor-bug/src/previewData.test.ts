/**
 * The preview page's data (packages/graphics/sponsor-bug)
 *
 * What this module is for:
 *   preview.html shows the bug as the design's sponsor-bug page does: "ENDURO",
 *   "Apresentado por" and Bosch's logo (a file of this package) on its light plate. The
 *   address switches parts off (`?sponsor=off`, `?word=off`, `?plate=off`) or gives the
 *   data itself (`?data=<JSON>`), which the screenshot tests use.
 *
 * What these tests prove:
 *   - Without a query, the preview shows the design's bug with every part on.
 *   - Each switch leaves out exactly its part.
 *   - `?data=` hands its JSON over as it is, and JSON that cannot be read is a pt-BR
 *     problem instead of a page that throws.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid; the graphic's own load() answers that, as for a renderer.
 *   - The page's buttons; e2e/sponsorBugLifecycle.e2e.ts presses them in Chromium.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData } from './previewData.js';
import type { SponsorBugData } from './sponsorBugModel.js';

/** Reads the data a query gives, failing the test when it cannot be read. */
function readSampleOfQuery(query: string): SponsorBugData {
  const choice = choosePreviewData(query);
  if (!choice.isReadable) {
    throw new Error(`the query ${query} should give readable data`);
  }
  return choice.data as SponsorBugData;
}

describe('choosePreviewData', () => {
  it('shows the design’s bug with every part on when the address says nothing', () => {
    // Arrange: an address with no query.

    // Act: choose the data.
    const data = readSampleOfQuery('');

    // Assert: the words, the plate, and the logo a file of the package.
    expect(
      { eventWord: data.eventWord, caption: data.caption, plate: data.sponsorLogoOnLightPlate },
      'the sample must be the design’s sponsor-bug page',
    ).toEqual({ eventWord: 'ENDURO', caption: 'Apresentado por', plate: true });
    expect(data.sponsorLogoUrl, 'the logo must be Bosch’s, a file of the package').toMatch(
      /bosch-logo.*\.webp$/,
    );
  });

  const switches = [
    // The design's bug without a sponsor: the mark and the word alone.
    {
      name: 'leaves out the sponsor with ?sponsor=off',
      query: '?sponsor=off',
      absent: 'sponsorLogoUrl',
    },
    // A session with no event word.
    { name: 'leaves out the event word with ?word=off', query: '?word=off', absent: 'eventWord' },
  ] as const;

  it.each(switches)('$name', ({ query, absent }) => {
    // Arrange: the query of this row.

    // Act: choose the data.
    const data = readSampleOfQuery(query);

    // Assert: exactly that part is gone.
    expect(Object.hasOwn(data, absent), `${absent} must be left out`).toBe(false);
  });

  it('takes the logo off its plate with ?plate=off', () => {
    // Arrange: the plate switched off.

    // Act: choose the data.
    const data = readSampleOfQuery('?plate=off');

    // Assert: the logo sits on the card.
    expect(data.sponsorLogoOnLightPlate, 'the plate must be off').toBe(false);
  });

  it('hands the JSON of ?data= over as it is', () => {
    // Arrange: a bug for the Super Prime, written into the address.
    const superPrimeBug = { eventWord: 'SUPER PRIME' };
    const query = `?data=${encodeURIComponent(JSON.stringify(superPrimeBug))}`;

    // Act: choose the data.
    const choice = choosePreviewData(query);

    // Assert: exactly that data, unchecked.
    expect(choice, 'the data must be handed over unchanged').toEqual({
      isReadable: true,
      data: superPrimeBug,
    });
  });

  it('says in pt-BR that ?data= cannot be read, instead of throwing', () => {
    // Arrange: an address whose data was cut short.

    // Act: choose the data.
    const choice = choosePreviewData('?data=%7B%22eventWord%22');

    // Assert: the problem in pt-BR.
    expect(choice, 'unreadable data must be a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
