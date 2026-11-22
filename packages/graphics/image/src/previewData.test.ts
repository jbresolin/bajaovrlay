/**
 * What preview.html shows, read from its address (packages/graphics/image)
 *
 * What this module is for:
 *   The preview page is how João and the screenshots see the image graphic without a
 *   server. previewData.ts turns the address (`?position=`, `?width=`, `?height=`, `?x=`,
 *   `?y=`, `?opacity=`, `?entrance=`, `?background=`, `?margin=`, `?image=missing` or a
 *   whole `?data=` JSON) into the data the page loads.
 *
 * What these tests prove:
 *   - With nothing in the address the sample is the mark alone, every default left to
 *     the graphic.
 *   - Every field the address can set is read as given, numbers as numbers, negative
 *     offsets included; the background's "#" arrives as "%23" in an address.
 *   - `?image=missing` swaps the mark for an address with no file behind it.
 *   - A `?data=` JSON is used as it is, and one that is not JSON gives a pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid; the graphic's load() decides, as on air.
 *   - The page itself; the Playwright suites open it.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData, missingImageAddress } from './previewData.js';

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
    expect(Object.keys(data), 'the sample must carry the image alone').toEqual(['imageUrl']);
    expect(data.imageUrl, 'the sample image must be a real file, not the missing one').not.toBe(
      missingImageAddress,
    );
  });

  it('reads every field the address sets, numbers as numbers', () => {
    // Arrange: the address of a small banner bottom-right, pulled in, on a dark plate.
    const addressQuery =
      '?position=bottom-right&width=335&height=120&x=-40&y=-20&opacity=50&entrance=none&background=%230a0a0a&margin=12';

    // Act: choose the data.
    const data = readSampleData(addressQuery);

    // Assert: each value as the address gives it.
    expect(data, 'the address values must reach the data').toMatchObject({
      position: 'bottom-right',
      entrance: 'none',
      backgroundColor: '#0a0a0a',
      widthPx: 335,
      heightPx: 120,
      offsetXPx: -40,
      offsetYPx: -20,
      opacityPercent: 50,
      marginPx: 12,
    });
  });

  it('swaps the mark for an address with no file behind it on ?image=missing', () => {
    // Arrange: the failed-file case's address.
    const addressQuery = '?image=missing';

    // Act: choose the data.
    const data = readSampleData(addressQuery);

    // Assert: the missing address.
    expect(data.imageUrl, 'the image must be the missing one').toBe('/media/imagem-que-nao-existe');
  });

  it('uses a ?data= JSON as it is, and gives a pt-BR problem for one that is not JSON', () => {
    // Arrange: a whole item's data, and a broken one.
    const goodQuery = `?data=${encodeURIComponent('{"imageUrl":"/media/4e2a91c7-cartaz","widthPx":600}')}`;
    const brokenQuery = '?data={imageUrl';

    // Act: choose the data for each.
    const goodChoice = choosePreviewData(goodQuery);
    const brokenChoice = choosePreviewData(brokenQuery);

    // Assert: the JSON as given; the broken one explained in pt-BR.
    expect(goodChoice, 'the JSON must be used as it is').toEqual({
      isReadable: true,
      data: { imageUrl: '/media/4e2a91c7-cartaz', widthPx: 600 },
    });
    expect(brokenChoice, 'a broken JSON must be explained in pt-BR').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
