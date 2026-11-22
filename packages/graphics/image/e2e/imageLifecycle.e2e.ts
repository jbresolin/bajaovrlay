/**
 * Image graphic lifecycle, driven like a renderer (packages/graphics/image, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in "main",
 *   registers its default export as a custom element and calls load, playAction,
 *   updateAction, stopAction and dispose on it. These tests do exactly that against the
 *   BUILT graphic (dist/), served under /graphics/image/ as the server serves it, in
 *   Chromium (the engine inside OBS), with the motion tokens on the page.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/image/: manifest, module and styles load.
 *   - load → play → update → stop → dispose each resolve in order with 200; the picture
 *     fades in (invisible before play, fully visible when play resolves) and out.
 *   - A move on air is drawn in place: the box is on its new point at once, still fully
 *     visible, with no fade again.
 *   - The fade takes the theme's 400 ms; "Entrada: Nenhuma" puts the picture fully on air
 *     at once, with no animation asked to be skipped.
 *   - A load whose file is missing answers 422 with the pt-BR message, at once, never
 *     waiting out the 2 s guard, and leaves no picture element.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps above follow OGraf v1 by hand.
 *   - Where each anchor puts the box and what it looks like; imagePlacement.e2e.ts.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('image.ograf.json');
  return page.evaluate(async () => {
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    const manifestResponse = await fetch('image.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-image', graphicModule.default);
    document.body.append(document.createElement('baja-image'));
    return manifest.id;
  });
}

/**
 * An event poster written into its own address (a 400x200 plate as SVG), so the
 * lifecycle runs on a file that really loads, with no file to serve or find in dist/.
 */
const eventPosterAsInlineSvg =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="white"/><text x="200" y="120" font-size="48" text-anchor="middle">ENDURO</text></svg>',
  );

test.describe('the image graphic driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, moving in place on air', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, noting each answer, the opacity and the box.
    const lifecycle = await page.evaluate(async (imageUrl) => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        stopAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-image') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const readBox = () =>
        graphic.shadowRoot?.querySelector<HTMLElement>('[data-testid="image-box"]') ?? null;
      const readBoxOpacity = () => {
        const box = readBox();
        return box ? Number(getComputedStyle(box).opacity) : -1;
      };

      const loadAnswer = await graphic.load({
        data: { imageUrl, widthPx: 400 },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacityBeforePlay = readBoxOpacity();
      const playAnswer = await graphic.playAction({});
      const opacityWhenPlayResolved = readBoxOpacity();
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({
        data: { position: 'top-left', offsetXPx: 50, offsetYPx: 20 },
      });
      const boxAfterTheMove = readBox()?.getBoundingClientRect();
      const opacityAfterTheMove = readBoxOpacity();
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacityWhenStopResolved = readBoxOpacity();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return {
        answers,
        opacityBeforePlay,
        opacityWhenPlayResolved,
        opacityAfterTheMove,
        boxAfterTheMove: { left: boxAfterTheMove?.left, top: boxAfterTheMove?.top },
        opacityWhenStopResolved,
      };
    }, eventPosterAsInlineSvg);

    // Assert: the manifest was read, every call resolved in order with 200, the picture
    // faded in, moved in place at once without fading again, and faded out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-image');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacityBeforePlay, 'a loaded picture must be invisible until play').toBe(0);
    expect(lifecycle.opacityWhenPlayResolved, 'play must resolve once the picture is in').toBe(1);
    expect(
      lifecycle.boxAfterTheMove,
      'the move must be on screen when the update resolves',
    ).toEqual({ left: 50, top: 20 });
    expect(lifecycle.opacityAfterTheMove, 'a move on air must not fade the picture again').toBe(1);
    expect(lifecycle.opacityWhenStopResolved, 'stop must resolve once the picture is out').toBe(0);
  });

  const entranceScenarios = [
    // The default: 150 ms into the 400 ms fade the picture is only part visible.
    { entrance: 'fade', isFullyInAt150Ms: false },
    // "Nenhuma": a cut, fully in before any time has passed.
    { entrance: 'none', isFullyInAt150Ms: true },
  ] as const;

  for (const scenario of entranceScenarios) {
    test(`with the entrance "${scenario.entrance}", is ${scenario.isFullyInAt150Ms ? 'fully' : 'only partly'} in 150 ms after play`, async ({
      page,
    }) => {
      // Arrange: the built graphic, loaded with the poster and this row's entrance.
      await loadGraphicFromItsManifestLikeARenderer(page);

      // Act: start play, as a normal take does (no skipAnimation), and look 150 ms in.
      const opacityAt150Ms = await page.evaluate(
        async ({ imageUrl, entrance }) => {
          type OGrafAction = (params: object) => Promise<{ statusCode: number }>;
          type OGrafGraphic = HTMLElement & { load: OGrafAction; playAction: OGrafAction };
          const graphic = document.querySelector('baja-image') as OGrafGraphic;
          await graphic.load({
            data: { imageUrl, entrance },
            renderType: 'realtime',
            renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
          });
          const box = graphic.shadowRoot?.querySelector('[data-testid="image-box"]');
          const pendingPlay = graphic.playAction({});
          await new Promise((resolve) => setTimeout(resolve, 150));
          const opacity = box ? Number(getComputedStyle(box).opacity) : -1;
          await pendingPlay;
          return opacity;
        },
        { imageUrl: eventPosterAsInlineSvg, entrance: scenario.entrance },
      );

      // Assert: part way for the fade, fully in for the cut.
      if (scenario.isFullyInAt150Ms) {
        expect(opacityAt150Ms, 'a cut must put the picture fully in at once').toBe(1);
      } else {
        expect(opacityAt150Ms, 'the fade must have started').toBeGreaterThan(0);
        expect(opacityAt150Ms, 'the fade must not be over yet').toBeLessThan(1);
      }
    });
  }

  test('answers 422 at once when the file is missing, and draws nothing', async ({ page }) => {
    // Arrange: the built graphic, loaded from its manifest.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: load it with an address that has no file behind it, timing the answer.
    const result = await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & {
        load: (params: object) => Promise<{ statusCode: number; statusMessage?: string }>;
      };
      const graphic = document.querySelector('baja-image') as OGrafGraphic;
      const startedAt = performance.now();
      const answer = await graphic.load({
        data: { imageUrl: '/media/imagem-que-nao-existe', backgroundColor: '#0a0a0a' },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      const pictureCount = graphic.shadowRoot?.querySelectorAll('img').length ?? -1;
      return { answer, pictureCount, waitedMs: performance.now() - startedAt };
    });

    // Assert: the 422 with its message, well before the 2 s guard, and no picture.
    expect(result.answer, 'a missing file must answer 422 naming the address').toEqual({
      statusCode: 422,
      statusMessage:
        'O arquivo da imagem não carregou (/media/imagem-que-nao-existe); nada aparece na tela. Escolha outra imagem.',
    });
    expect(result.pictureCount, 'a missing file must leave no picture element').toBe(0);
    expect(result.waitedMs, 'a missing file must be reported at once').toBeLessThan(1500);
  });
});
