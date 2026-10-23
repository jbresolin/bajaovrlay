/**
 * Notice lifecycle, driven like a renderer (packages/graphics/notice, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in
 *   "main", registers its default export as a custom element and then calls load,
 *   playAction, updateAction, stopAction and dispose on it. These tests do exactly that
 *   against the BUILT graphic (dist/), served under /graphics/notice/ as the server will
 *   serve it, in Chromium (the engine inside OBS), with the theme's tokens on the page.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/notice/: manifest, module and styles load.
 *   - load → play → update → stop → dispose each resolve, in that order, with 200; play
 *     reports step 0.
 *   - Play brings the card in: invisible and below its place when play starts, fully
 *     visible and in its place when play resolves. Stop takes it out: invisible when
 *     stop resolves.
 *   - The card stays on air after play: a second later it is still fully visible, since
 *     the hold is the server's (notice.ts says why).
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer) and the server's auto-out; the steps
 *     above are done by hand, following the OGraf v1 spec.
 *   - What the graphic looks like; noticeScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id so the test can check
 * it was really read.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('notice.ograf.json');
  return page.evaluate(async () => {
    // The renderer page links the theme's tokens.css; here the two motion lengths the
    // test watches are placed by hand, with the Ardósia values.
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifestResponse = await fetch('notice.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-notice', graphicModule.default);
    document.body.append(document.createElement('baja-notice'));
    return manifest.id;
  });
}

test.describe('the notice driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, waiting for each call before the next, and
    // note each answer and how visible the card is at each moment.
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
      const graphic = document.querySelector('baja-notice') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const readCardOpacity = () => {
        const panel = graphic.shadowRoot?.querySelector('[data-testid="notice-panel"]');
        return panel ? Number(getComputedStyle(panel).opacity) : -1;
      };

      const loadAnswer = await graphic.load({
        data: {
          variant: 'penalty',
          carNumber: 47,
          teamName: 'Carnaúba Baja',
          schoolName: 'UFERSA',
          reason: 'Queima de largada',
          penaltyText: '+30 segundos',
        },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacityBeforePlay = readCardOpacity();
      const playAnswer = await graphic.playAction({});
      const opacityWhenPlayResolved = readCardOpacity();
      answers.push({ action: 'play', ...playAnswer });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const opacityOneSecondLater = readCardOpacity();
      const updateAnswer = await graphic.updateAction({ data: { noticeKind: 'warning' } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacityWhenStopResolved = readCardOpacity();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return {
        answers,
        opacityBeforePlay,
        opacityWhenPlayResolved,
        opacityOneSecondLater,
        opacityWhenStopResolved,
      };
    });

    // Assert: the manifest was read, every call resolved in order with 200, play
    // reported step 0, the card came in and stayed, and stop took it out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-notice');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacityBeforePlay, 'a loaded notice must be invisible until play').toBe(0);
    expect(lifecycle.opacityWhenPlayResolved, 'play must resolve once the card is in').toBe(1);
    expect(lifecycle.opacityOneSecondLater, 'the notice must not leave by itself').toBe(1);
    expect(lifecycle.opacityWhenStopResolved, 'stop must resolve once the card is out').toBe(0);
  });

  test('animates the play-in instead of snapping: half way the card is part visible and rising', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest with a fastest lap.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: start play and look at the card 150 ms into the 400 ms rise.
    const halfWay = await page.evaluate(async () => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number }>;
      type OGrafGraphic = HTMLElement & { load: OGrafAction; playAction: OGrafAction };
      const graphic = document.querySelector('baja-notice') as OGrafGraphic;
      await graphic.load({
        data: {
          variant: 'fastestLap',
          carNumber: 31,
          teamName: 'Acauã Baja',
          lapTimeText: '4:38,2',
        },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      const panel = graphic.shadowRoot?.querySelector('[data-testid="notice-panel"]');
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
