/**
 * Logo bug lifecycle, driven like a renderer (packages/graphics/logo-bug, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in "main",
 *   registers its default export as a custom element and calls load, playAction,
 *   updateAction, stopAction and dispose on it. These tests do exactly that against the
 *   BUILT graphic (dist/), served under /graphics/logo-bug/ as the server serves it, in
 *   Chromium (the engine inside OBS), with the motion tokens on the page.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/logo-bug/: manifest, module and styles load.
 *   - load → play → update → stop → dispose each resolve in order with 200; play reports
 *     step 0; the logo fades in (invisible before play, fully visible when play resolves)
 *     and out (invisible when stop resolves).
 *   - A load whose image is missing answers 422 with the pt-BR message, at once, never
 *     waiting out the 2 s guard.
 *   - A failed image is asked for again on the next update at the same address: Chromium
 *     really sends a second request (no cached failure), and the logo shows once it works.
 *   - The fade in is a fade: part way through, the logo is part visible and has not moved.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps above follow OGraf v1 by hand.
 *   - What the logo looks like; logoBugScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('logo-bug.ograf.json');
  return page.evaluate(async () => {
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    const manifestResponse = await fetch('logo-bug.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-logo-bug', graphicModule.default);
    document.body.append(document.createElement('baja-logo-bug'));
    return manifest.id;
  });
}

/**
 * A small channel logo written into its own address (a white "BAJA" plate as SVG), so the
 * lifecycle runs on an image that really loads, with no file to serve or find in dist/.
 */
const channelLogoAsInlineSvg =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="white"/><text x="80" y="52" font-size="36" text-anchor="middle">BAJA</text></svg>',
  );

test.describe('the logo bug driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, fading in and out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, noting each answer and the logo's opacity.
    const lifecycle = await page.evaluate(async (logoUrl) => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        stopAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-logo-bug') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const readPanelOpacity = () => {
        const panel = graphic.shadowRoot?.querySelector('[data-testid="logo-bug-panel"]');
        return panel ? Number(getComputedStyle(panel).opacity) : -1;
      };

      const loadAnswer = await graphic.load({
        data: { logoUrl },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacityBeforePlay = readPanelOpacity();
      const playAnswer = await graphic.playAction({});
      const opacityWhenPlayResolved = readPanelOpacity();
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({ data: { corner: 'top-left' } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacityWhenStopResolved = readPanelOpacity();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, opacityBeforePlay, opacityWhenPlayResolved, opacityWhenStopResolved };
    }, channelLogoAsInlineSvg);

    // Assert: the manifest was read, every call resolved in order with 200, the logo
    // faded in and out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-logo-bug');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacityBeforePlay, 'a loaded logo must be invisible until play').toBe(0);
    expect(lifecycle.opacityWhenPlayResolved, 'play must resolve once the logo is in').toBe(1);
    expect(lifecycle.opacityWhenStopResolved, 'stop must resolve once the logo is out').toBe(0);
  });

  test('answers 422 at once when the image is missing', async ({ page }) => {
    // Arrange: the built graphic, loaded from its manifest.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: load it with an address that has no file behind it, timing the answer.
    const result = await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & {
        load: (params: object) => Promise<{ statusCode: number; statusMessage?: string }>;
      };
      const graphic = document.querySelector('baja-logo-bug') as OGrafGraphic;
      const startedAt = performance.now();
      const answer = await graphic.load({
        data: { logoUrl: '/media/logo-que-nao-existe' },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      return { answer, waitedMs: performance.now() - startedAt };
    });

    // Assert: the 422 with its message, well before the 2 s guard would end the wait.
    expect(result.answer, 'a missing image must answer 422 naming the address').toEqual({
      statusCode: 422,
      statusMessage:
        'A imagem do logo não carregou (/media/logo-que-nao-existe); o logo fica vazio. Escolha outra imagem.',
    });
    expect(result.waitedMs, 'a missing image must be reported at once').toBeLessThan(1500);
  });

  test('asks for a failed image again on an update at the same address, and shows it', async ({
    page,
  }) => {
    // Arrange: the built graphic, and a logo file that is not there at the first request
    // (still uploading) but is at the second.
    await loadGraphicFromItsManifestLikeARenderer(page);
    let requestsForTheLogo = 0;
    await page.route('**/media/logo-ainda-enviando.svg', async (route) => {
      requestsForTheLogo += 1;
      if (requestsForTheLogo === 1) {
        await route.fulfill({ status: 404, body: '' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: decodeURIComponent(channelLogoAsInlineSvg.slice('data:image/svg+xml,'.length)),
      });
    });

    // Act: load it (the file fails), then update it with the very same data.
    const result = await page.evaluate(async () => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number }>;
      type OGrafGraphic = HTMLElement & { load: OGrafAction; updateAction: OGrafAction };
      const graphic = document.querySelector('baja-logo-bug') as OGrafGraphic;
      const logoData = { logoUrl: '/media/logo-ainda-enviando.svg' };
      const loadAnswer = await graphic.load({
        data: logoData,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      const updateAnswer = await graphic.updateAction({ data: logoData });
      const image = graphic.shadowRoot?.querySelector<HTMLImageElement>('img');
      return {
        loadStatus: loadAnswer.statusCode,
        updateStatus: updateAnswer.statusCode,
        imageState: image?.dataset.imageState,
        imageWidth: image?.naturalWidth ?? 0,
      };
    });

    // Assert: 422 then 200, two requests, and the logo drawn.
    expect(result.loadStatus, 'the first request fails, so load must answer 422').toBe(422);
    expect(result.updateStatus, 'the update must answer 200').toBe(200);
    expect(requestsForTheLogo, 'Chromium must have asked for the file a second time').toBe(2);
    expect(result.imageState, 'the logo must be shown once its file arrived').toBe('loaded');
    expect(result.imageWidth, 'the file must really have been drawn').toBeGreaterThan(0);
  });

  test('fades in without moving: half way the logo is part visible and in its place', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest with the logo.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: start play and look at the panel 150 ms into the 400 ms fade.
    const halfWay = await page.evaluate(async (logoUrl) => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number }>;
      type OGrafGraphic = HTMLElement & { load: OGrafAction; playAction: OGrafAction };
      const graphic = document.querySelector('baja-logo-bug') as OGrafGraphic;
      await graphic.load({
        data: { logoUrl },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      const panel = graphic.shadowRoot?.querySelector('[data-testid="logo-bug-panel"]');
      const pendingPlay = graphic.playAction({});
      await new Promise((resolve) => setTimeout(resolve, 150));
      const opacity = panel ? Number(getComputedStyle(panel).opacity) : -1;
      const transform = panel ? getComputedStyle(panel).transform : 'missing';
      await pendingPlay;
      return { opacity, transform };
    }, channelLogoAsInlineSvg);

    // Assert: part visible, and no transform at all: a fade, never a rise.
    expect(halfWay.opacity, 'half way the logo must be fading in').toBeGreaterThan(0);
    expect(halfWay.opacity, 'half way the logo must not be fully in yet').toBeLessThan(1);
    expect(halfWay.transform, 'the logo must not move while it fades').toBe('none');
  });
});
