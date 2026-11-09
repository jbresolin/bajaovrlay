/**
 * What preview.html shows, read from its address (packages/graphics/logo-bug)
 *
 * What this module is for:
 *   The preview page is how João and the screenshots see the logo bug without a server.
 *   previewData.ts turns the address (`?corner=`, `?height=`, `?opacity=`, `?image=missing`
 *   or a whole `?data=` JSON) into the data the page loads.
 *
 * What these tests prove:
 *   - With nothing in the address the sample is the mark alone, every default left to
 *     the graphic.
 *   - The corner, the height and the opacity are read as given, numbers as numbers.
 *   - `?image=missing` swaps the mark for an address with no file behind it.
 *   - A `?data=` JSON is used as it is, and one that is not JSON gives a pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid; the graphic's load() decides, as on air.
 *   - The page itself; the Playwright suites open it.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData, missingLogoAddress } from './previewData.js';

/** Reads the sample data from an address, failing the test when it is not readable. */
function readSampleData(addressQuery: string): Record<string, unknown> {
  const choice = choosePreviewData(addressQuery);
  if (!choice.isReadable) {
    throw new Error(`the address ${addressQuery} should be readable: ${choice.problem}`);
  }
  return choice.data as Record<string, unknown>;
}

describe('choosePreviewData', () => {
  it('shows the mark alone when the address asks for nothing', () => {
    // Arrange: an address with no query.
    const addressQuery = '';

    // Act: choose the data.
    const data = readSampleData(addressQuery);

    // Assert: only the image, so every default is the graphic's own.
    expect(Object.keys(data), 'the sample must carry the image alone').toEqual(['logoUrl']);
    expect(data.logoUrl, 'the sample image must be a real file, not the missing one').not.toBe(
      missingLogoAddress,
    );
  });

  it('reads the corner, the height and the opacity, numbers as numbers', () => {
    // Arrange: the address of the small, half-transparent top-left screenshot.
    const addressQuery = '?corner=top-left&height=32&opacity=50';

    // Act: choose the data.
    const data = readSampleData(addressQuery);

    // Assert: each value as the address gives it.
    expect(
      { corner: data.corner, heightPx: data.heightPx, opacityPercent: data.opacityPercent },
      'the address values must reach the data',
    ).toEqual({ corner: 'top-left', heightPx: 32, opacityPercent: 50 });
  });

  it('swaps the mark for an address with no file behind it on ?image=missing', () => {
    // Arrange: the failed-image screenshot's address.
    const addressQuery = '?image=missing';

    // Act: choose the data.
    const data = readSampleData(addressQuery);

    // Assert: the missing address.
    expect(data.logoUrl, 'the image must be the missing one').toBe('/media/logo-que-nao-existe');
  });

  it('uses a ?data= JSON as it is, and gives a pt-BR problem for one that is not JSON', () => {
    // Arrange: a whole item's data, and a broken one.
    const goodQuery = `?data=${encodeURIComponent('{"logoUrl":"/media/3b8f0c2e-logo","heightPx":120}')}`;
    const brokenQuery = '?data={logoUrl';

    // Act: choose the data for each.
    const goodChoice = choosePreviewData(goodQuery);
    const brokenChoice = choosePreviewData(brokenQuery);

    // Assert: the JSON as given; the broken one explained in pt-BR.
    expect(goodChoice, 'the JSON must be used as it is').toEqual({
      isReadable: true,
      data: { logoUrl: '/media/3b8f0c2e-logo', heightPx: 120 },
    });
    expect(brokenChoice, 'a broken JSON must be explained in pt-BR').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
