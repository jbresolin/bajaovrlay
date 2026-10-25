/**
 * QR card lifecycle and scan, in Chromium (packages/graphics/qr-card, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in "main",
 *   registers its default export as a custom element and then calls load, playAction,
 *   updateAction, stopAction and dispose on it. These tests do exactly that against the
 *   BUILT graphic (dist/), served under /graphics/qr-card/ as the server will serve it, in
 *   Chromium (the engine inside OBS). They also take a picture of the code as Chromium
 *   draws it on the preview page (with the theme) and read it with jsQR, as a phone would.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/qr-card/: manifest, module (with the encoder
 *     bundled in) and styles load.
 *   - load → play → update → stop → dispose each resolve, in that order, with 200; play
 *     reports step 0; play brings the card in and stop takes it out.
 *   - The play-in is animated: part way through, the card is part visible and still rising.
 *   - The pixels of the code on screen scan back to the address, for the design's address
 *     and for one of the longest length (the smallest modules the card draws, 4 px).
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps above are done by hand,
 *     following the OGraf v1 spec.
 *   - What the card looks like; qrCardScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

import { buildLongestSampleAddress } from '../src/previewData.js';
import { scanQrCodeOnScreen } from './qrCodeOnScreen.testSupport.js';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('qr-card.ograf.json');
  return page.evaluate(async () => {
    // The renderer page links the theme's tokens.css; here the motion values the test
    // watches are placed by hand, with the Ardósia values.
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifestResponse = await fetch('qr-card.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-qr-card', graphicModule.default);
    document.body.append(document.createElement('baja-qr-card'));
    return manifest.id;
  });
}

/** Scans the card on this page as Chromium drew it (qrCodeOnScreen.testSupport.ts). */
async function scanTheCardOnScreen(page: Page): Promise<string | undefined> {
  return scanQrCodeOnScreen(page, page.getByTestId('qr-card-panel'));
}

test.describe('the QR card driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, waiting for each call before the next, and note
    // each answer and how visible the card is.
    const lifecycle = await page.evaluate(async () => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        stopAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-qr-card') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const readCardOpacity = () => {
        const panel = graphic.shadowRoot?.querySelector('[data-testid="qr-card-panel"]');
        return panel ? Number(getComputedStyle(panel).opacity) : -1;
      };

      const loadAnswer = await graphic.load({
        data: {
          callToAction: 'Acompanhe os resultados',
          address: 'resultados.bajasaebrasil.net',
        },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacityBeforePlay = readCardOpacity();
      const playAnswer = await graphic.playAction({});
      const opacityWhenPlayResolved = readCardOpacity();
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({
        data: { address: 'bajasaebrasil.net/ao-vivo' },
      });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacityWhenStopResolved = readCardOpacity();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, opacityBeforePlay, opacityWhenPlayResolved, opacityWhenStopResolved };
    });

    // Assert: the manifest was read, every call resolved in order with 200, play reported
    // step 0, the card came in and went out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-qr-card');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacityBeforePlay, 'a loaded card must be invisible until play').toBe(0);
    expect(lifecycle.opacityWhenPlayResolved, 'play must resolve once the card is in').toBe(1);
    expect(lifecycle.opacityWhenStopResolved, 'stop must resolve once the card is out').toBe(0);
  });

  test('animates the play-in instead of snapping: half way the card is part visible and rising', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: start play and look at the card 150 ms into the 400 ms rise.
    const halfWay = await page.evaluate(async () => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number }>;
      type OGrafGraphic = HTMLElement & { load: OGrafAction; playAction: OGrafAction };
      const graphic = document.querySelector('baja-qr-card') as OGrafGraphic;
      await graphic.load({
        data: { callToAction: 'Assista ao vivo', address: 'bajasaebrasil.net/ao-vivo' },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      const panel = graphic.shadowRoot?.querySelector('[data-testid="qr-card-panel"]');
      const pendingPlay = graphic.playAction({});
      await new Promise((resolve) => setTimeout(resolve, 150));
      const opacity = panel ? Number(getComputedStyle(panel).opacity) : -1;
      const rise = panel ? new DOMMatrix(getComputedStyle(panel).transform).m42 : -1;
      await pendingPlay;
      return { opacity, rise };
    });

    // Assert: part way through, the card is neither invisible nor fully in, and still
    // below its place (a positive y offset, under the 20 px it started from).
    expect(halfWay.opacity, 'half way the card must be fading in').toBeGreaterThan(0);
    expect(halfWay.opacity, 'half way the card must not be fully in yet').toBeLessThan(1);
    expect(halfWay.rise, 'half way the card must still be rising').toBeGreaterThan(0);
    expect(halfWay.rise, 'half way the card must have risen from 20 px').toBeLessThan(20);
  });
});

const scanScenarios = [
  // The design's card: a version 3 code, 5 px a module.
  {
    name: 'the design’s address',
    previewAddress: 'preview.html?stage=black',
    address: 'resultados.bajasaebrasil.net',
  },
  // The largest code the card draws: version 6, 4 px a module, the hardest to read.
  {
    name: 'an address of the longest length',
    previewAddress: 'preview.html?stage=black&address=longest',
    address: buildLongestSampleAddress(),
  },
];

test.describe('the code on screen scans', () => {
  for (const scenario of scanScenarios) {
    test(`back to ${scenario.name}`, async ({ page }) => {
      // Arrange: the preview on air, with the theme's tokens and face.
      await page.goto(scenario.previewAddress);
      await expect(page.locator('body'), 'the QR card must be on air').toHaveAttribute(
        'data-preview-state',
        'onAir',
      );

      // Act: picture the card as drawn and read it as a phone would.
      const scannedText = await scanTheCardOnScreen(page);

      // Assert: the code on screen opens exactly the address.
      expect(scannedText, 'the pixels on screen must scan back to the address').toBe(
        scenario.address,
      );
    });
  }
});
