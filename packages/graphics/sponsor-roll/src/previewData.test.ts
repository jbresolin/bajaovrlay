/**
 * What the sponsor roll's preview page loads (packages/graphics/sponsor-roll)
 *
 * What this module is for:
 *   preview.html shows the design's sample, the 30ª Competição's 17 sponsors with their real
 *   logos, on the full screen or, with `?layout=corner`, in the corner; `?data=<JSON>`
 *   replaces it with any data, which the graphic's own load then judges.
 *
 * What these tests prove:
 *   - The sample is the full screen with the 17, in round order, Vetore's light logo off the
 *     plate and every other on it; `?layout=corner` gives the corner with "ENDURO".
 *   - `?data=` is read as JSON as it is; text that is not JSON gives the pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - The page's buttons; the e2e tests drive the built preview.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData } from './previewData.js';
import type { SponsorRollData } from './sponsorRollModel.js';

describe('choosePreviewData', () => {
  it('gives the 17 on the full screen, Vetore alone off the plate', () => {
    // Arrange: an address with no query.

    // Act: choose the data.
    const choice = choosePreviewData('');
    const data = choice.isReadable ? (choice.data as SponsorRollData) : undefined;

    // Assert: the full screen, 17 sponsors, the organiser last, one logo off the plate.
    expect(data?.layout, 'the full screen').toBe('fullscreen');
    expect(data?.sponsors.length, 'the 17').toBe(17);
    expect(data?.sponsors.at(-1)?.name, 'the organiser last').toBe('SAE Brasil');
    expect(
      data?.sponsors.filter((sponsor) => !sponsor.logoOnLightPlate).map((sponsor) => sponsor.name),
      'Vetore’s light logo straight on the card',
    ).toEqual(['Vetore']);
  });

  it('gives the corner with the enduro’s word with ?layout=corner', () => {
    // Arrange: the corner's address.

    // Act: choose the data.
    const choice = choosePreviewData('?layout=corner');
    const data = choice.isReadable ? (choice.data as SponsorRollData) : undefined;

    // Assert: the corner, "ENDURO".
    expect([data?.layout, data?.eventWord], 'the corner').toEqual(['corner', 'ENDURO']);
  });

  it('reads ?data= as JSON, and says when it is not', () => {
    // Arrange: a broken text.

    // Act: choose the data.
    const choice = choosePreviewData('?data=%7Bquebrado');

    // Assert: the pt-BR problem.
    expect(choice, 'a broken text says why').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
