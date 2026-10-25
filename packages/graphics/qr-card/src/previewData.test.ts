/**
 * What the preview page shows (packages/graphics/qr-card)
 *
 * What this module is for:
 *   previewData.ts chooses the data preview.html loads: the JSON in `?data=`, or the
 *   design's card, or (`?address=longest`) the same card with an address of exactly the
 *   longest length, the largest code the card draws. The screenshots and the e2e scan open
 *   these addresses.
 *
 * What these tests prove:
 *   - With no parameter, the design's card (qr-card.html): "Acompanhe os resultados",
 *     resultados.bajasaebrasil.net.
 *   - `?address=longest` gives an address of exactly 106 characters that reads like a real
 *     one and that the model accepts.
 *   - `?data=` is passed through as parsed, and JSON that cannot be read gives the pt-BR
 *     problem instead of a throw.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid for the card; load answers that, as for a renderer.
 *   - The stage parameter; the kit's previewStage tests cover it.
 */
import { describe, expect, it } from 'vitest';

import { buildLongestSampleAddress, choosePreviewData } from './previewData.js';
import { findProblemInAddress } from './qrCardModel.js';

describe('choosePreviewData', () => {
  it('opens on the design’s card when the address names no data', () => {
    // Arrange: a preview address with the stage only.
    const addressQuery = '?stage=grey';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the design page's words.
    expect(choice, 'the preview must open on the design’s card').toEqual({
      isReadable: true,
      data: { callToAction: 'Acompanhe os resultados', address: 'resultados.bajasaebrasil.net' },
    });
  });

  it('gives the longest address with ?address=longest', () => {
    // Arrange: the preview address the longest screenshot opens.
    const addressQuery = '?address=longest';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the design's call and an address of exactly the limit.
    expect(choice, 'the longest sample must be the design’s call with the longest address').toEqual(
      {
        isReadable: true,
        data: { callToAction: 'Acompanhe os resultados', address: buildLongestSampleAddress() },
      },
    );
  });

  it('passes the JSON of ?data= through as parsed', () => {
    // Arrange: an address carrying a card of its own.
    const data = { callToAction: 'Assista ao vivo', address: 'bajasaebrasil.net/ao-vivo' };
    const addressQuery = `?data=${encodeURIComponent(JSON.stringify(data))}`;

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the same object, for load to judge.
    expect(choice, 'the data in the address must be loaded as given').toEqual({
      isReadable: true,
      data,
    });
  });

  it('answers the pt-BR problem when ?data= is not JSON', () => {
    // Arrange: an address with broken JSON.
    const addressQuery = '?data=%7Bchamada';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: a problem, never a throw.
    expect(choice, 'broken JSON must give the pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});

describe('buildLongestSampleAddress', () => {
  it('is exactly 106 characters of a real-looking address the model accepts', () => {
    // Arrange: nothing to set up.

    // Act: build it.
    const address = buildLongestSampleAddress();

    // Assert: the length of the limit, the results site, and no problem for the model.
    expect(address.length, 'the sample must be exactly the longest length').toBe(106);
    expect(address.startsWith('https://resultados.bajasaebrasil.net/'), 'a real address').toBe(
      true,
    );
    expect(findProblemInAddress(address), 'the model must accept it').toBeUndefined();
  });
});
