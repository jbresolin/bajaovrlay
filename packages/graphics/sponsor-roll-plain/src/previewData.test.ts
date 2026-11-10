/**
 * What the preview page shows (packages/graphics/sponsor-roll-plain)
 *
 * What this module is for:
 *   preview.html shows the plain roll without a server: the 30ª Competição's sponsors with
 *   their real logos, one of them alone when the address names it (so a screenshot is taken
 *   before any turn), in the corner the address asks for, or the JSON of `?data=`.
 *
 * What these tests prove:
 *   - With nothing in the address, all 17 sponsors, in the default corner.
 *   - `?sponsor=Criciúma&corner=bottom-left` gives Criciúma alone, bottom-left.
 *   - `?data=` is read as JSON, and JSON that does not parse is a pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid; the graphic's load() decides, as on air.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData } from './previewData.js';

/** The names of the sponsors in a readable choice, or undefined for a problem. */
function readSponsorNames(addressQuery: string): string[] | undefined {
  const choice = choosePreviewData(addressQuery);
  if (!choice.isReadable) {
    return undefined;
  }
  const data = choice.data as { sponsors: Array<{ name: string }> };
  return data.sponsors.map((sponsor) => sponsor.name);
}

describe('the preview’s data', () => {
  it('shows the 17 sponsors in the default corner when the address says nothing', () => {
    // Arrange: an address with no query.

    // Act: choose the data.
    const choice = choosePreviewData('');

    // Assert: all 17, Bosch first, and no corner (the graphic's default).
    expect(readSponsorNames(''), 'the whole sample').toHaveLength(17);
    expect(choice.isReadable && 'corner' in (choice.data as object), 'no corner given').toBe(false);
  });

  it('keeps one sponsor alone, in the corner the address names', () => {
    // Arrange: Criciúma (Apoio, the short heading) in the bottom-left corner.
    const addressQuery = '?sponsor=Crici%C3%BAma&corner=bottom-left';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: Criciúma alone, bottom-left.
    expect(readSponsorNames(addressQuery), 'one sponsor').toEqual(['Criciúma']);
    expect(choice.isReadable && (choice.data as { corner?: string }).corner, 'the corner').toBe(
      'bottom-left',
    );
  });

  it('reads `?data=` as JSON, and names a broken one in pt-BR', () => {
    // Arrange: one good address and one broken.
    const goodQuery = `?data=${encodeURIComponent('{"sponsors":[{"name":"Bosch","level":"diamante"}]}')}`;

    // Act: choose the data of each.
    const goodChoice = choosePreviewData(goodQuery);
    const brokenChoice = choosePreviewData('?data={sponsors');

    // Assert: the JSON as written; the broken one as a problem.
    expect(goodChoice, 'the JSON is passed on as written').toEqual({
      isReadable: true,
      data: { sponsors: [{ name: 'Bosch', level: 'diamante' }] },
    });
    expect(brokenChoice, 'a broken JSON is a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
