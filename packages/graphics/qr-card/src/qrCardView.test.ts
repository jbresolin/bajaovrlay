/**
 * The QR card's DOM (packages/graphics/qr-card)
 *
 * What this module is for:
 *   qrCardView.ts draws the card with Lit: the code's box with the code as an inline SVG of
 *   one path, then the call to action over the address. The card element puts the drawing
 *   together at load (the squares, and the plan of whole px read from `--qr-size`).
 *
 * What these tests prove:
 *   - The drawn code scans back to the address (its own path, read back and given to jsQR),
 *     for the design's address and for one of the longest length: the card shows a code
 *     that works, not only one the encoder made.
 *   - The code's SVG is sized in whole px from the box the theme sets: with `--qr-size` at
 *     176 px, the longest address gives 4 px modules, 172 px drawn, 2 px before; its viewBox
 *     starts one quiet-zone module before the first square; it asks for crisp edges; and it
 *     has an accessible name with the address.
 *   - The call to action and the address are written as typed (the caps come from the
 *     stylesheet), each in its own part.
 *   - Before load the card is an empty element.
 *
 * What these tests deliberately do not cover:
 *   - The pixels Chromium draws; e2e/qrCardLifecycle.e2e.ts scans a screenshot of the code
 *     and the screenshots pin the look.
 *   - Which version an address needs; qrCodeEncoding.test.ts.
 */
import { render } from 'lit';
import { describe, expect, it, onTestFinished } from 'vitest';

import { buildLongestSampleAddress } from './previewData.js';
import {
  createQrCardOnThePage,
  findPartOfQrCard,
  loadQrCardWithData,
  readDrawnCode,
  readShownText,
} from './qrCardOnThePage.testSupport.js';
import { renderQrCardTemplate } from './qrCardView.js';
import { readQrModulesFromPathData, scanQrModules } from './qrCodeScanning.testSupport.js';

const scanScenarios = [
  // The design's card, a version 3 code.
  { name: 'the design’s address', address: 'resultados.bajasaebrasil.net' },
  // The largest code the card draws.
  { name: 'an address of the longest length', address: buildLongestSampleAddress() },
];

describe('the code drawn on the card', () => {
  it.each(scanScenarios)('scans back to $name', async ({ address }) => {
    // Arrange: a QR card loaded with the address.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, { callToAction: 'Acompanhe os resultados', address });

    // Act: read the squares back from the path the card drew and scan them.
    const { pathData, moduleCount } = readDrawnCode(qrCard);
    const scannedText = scanQrModules(readQrModulesFromPathData(pathData, moduleCount));

    // Assert: the card's own code opens the address.
    expect(scannedText, 'the code on the card must scan back to the address').toBe(address);
  });

  it('is sized in whole px from --qr-size: 4 px modules for the longest address', async () => {
    // Arrange: the theme's box on the card element, and the longest address.
    const qrCard = createQrCardOnThePage();
    qrCard.style.setProperty('--qr-size', '176px');

    // Act: load it.
    await loadQrCardWithData(qrCard, {
      callToAction: 'Acompanhe os resultados',
      address: buildLongestSampleAddress(),
    });
    const code = findPartOfQrCard(qrCard, 'qr-card-code');

    // Assert: 41 modules and the quiet zone at 4 px (172 px), 2 px before, crisp, named.
    expect(code?.getAttribute('viewBox'), 'one quiet-zone module around 41 modules').toBe(
      '-1 -1 43 43',
    );
    expect(code?.getAttribute('style'), 'the code must be 172 px, 2 px into its box').toBe(
      'width: 172px; height: 172px; margin: 2px 0 0 2px;',
    );
    expect(code?.getAttribute('shape-rendering'), 'no square edge may be smoothed').toBe(
      'crispEdges',
    );
    expect(code?.getAttribute('aria-label'), 'the code must be named by its address').toBe(
      `Código QR do endereço ${buildLongestSampleAddress()}`,
    );
  });
});

describe('the text', () => {
  it('writes the call to action and the address as typed, each in its own part', async () => {
    // Arrange: a QR card and an address with capitals in its path.
    const qrCard = createQrCardOnThePage();

    // Act: load it.
    await loadQrCardWithData(qrCard, {
      callToAction: 'Assista ao vivo',
      address: 'bajasaebrasil.net/Ao-Vivo',
    });

    // Assert: the words as sent; the stylesheet sets them in caps.
    expect(readShownText(qrCard, 'qr-card-call-to-action'), 'the call must be drawn').toBe(
      'Assista ao vivo',
    );
    expect(readShownText(qrCard, 'qr-card-address'), 'the address must be drawn as typed').toBe(
      'bajasaebrasil.net/Ao-Vivo',
    );
  });
});

describe('renderQrCardTemplate before load', () => {
  it('draws an empty card element, waiting for data', () => {
    // Arrange: a container on the page.
    const container = document.createElement('div');
    document.body.append(container);
    onTestFinished(() => container.remove());

    // Act: render the template with no drawing yet.
    render(renderQrCardTemplate(undefined), container);

    // Assert: the card exists and holds no code and no text.
    const panel = container.querySelector('[data-testid="qr-card-panel"]');
    expect(panel, 'the card element must exist before load').not.toBeNull();
    expect(panel?.children.length, 'nothing may be drawn before load').toBe(0);
  });
});
