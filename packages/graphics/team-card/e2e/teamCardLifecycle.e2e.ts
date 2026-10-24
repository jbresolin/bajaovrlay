/**
 * Team card lifecycle, driven like a renderer (packages/graphics/team-card, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in
 *   "main", registers its default export as a custom element and then calls load,
 *   playAction, updateAction, stopAction and dispose on it. These tests do exactly that
 *   against the BUILT graphic (dist/), served under /graphics/team-card/ as the server
 *   will serve it, in Chromium (the engine inside OBS), with the motion tokens on the page.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/team-card/: manifest, module and styles load.
 *   - load → play → update → stop → dispose each resolve, in that order, with 200; play
 *     reports step 0.
 *   - Play brings the card in: invisible before, fully visible when play resolves. Stop
 *     takes it out: invisible when stop resolves.
 *   - A logo whose address is broken never blocks: load still answers 200 and the card
 *     plays.
 *   - The play-in is animated: part way through, the whole card is part visible and
 *     still rising.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps above are done by hand,
 *     following the OGraf v1 spec.
 *   - What the graphic looks like; teamCardScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('team-card.ograf.json');
  return page.evaluate(async () => {
    // The renderer page links the theme's tokens.css; here the motion values the test
    // watches are placed by hand, with the Ardósia values.
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifestResponse = await fetch('team-card.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-team-card', graphicModule.default);
    document.body.append(document.createElement('baja-team-card'));
    return manifest.id;
  });
}

test.describe('the team card driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle with a logo whose address is broken, waiting
    // for each call before the next, and note each answer and how visible the card is.
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
      const graphic = document.querySelector('baja-team-card') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const readCardOpacity = () => {
        const panel = graphic.shadowRoot?.querySelector('[data-testid="team-card-panel"]');
        return panel ? Number(getComputedStyle(panel).opacity) : -1;
      };

      const loadAnswer = await graphic.load({
        data: {
          carNumber: 7,
          teamName: 'Reptiles Baja PUC-Rio',
          schoolName: 'PUC-Rio',
          city: 'Rio de Janeiro',
          state: 'RJ',
          logoUrl: '/media/logo-que-nao-existe',
          logoOnLightPlate: true,
        },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacityBeforePlay = readCardOpacity();
      const playAnswer = await graphic.playAction({});
      const opacityWhenPlayResolved = readCardOpacity();
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({ data: { city: 'Niterói' } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacityWhenStopResolved = readCardOpacity();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, opacityBeforePlay, opacityWhenPlayResolved, opacityWhenStopResolved };
    });

    // Assert: the manifest was read, every call resolved in order with 200 (the broken
    // logo blocked nothing), play reported step 0, the card came in and went out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-team-card');
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
    // Arrange: the built graphic, loaded from its manifest with car 47 and no media.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: start play and look at the card 150 ms into the 400 ms rise.
    const halfWay = await page.evaluate(async () => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number }>;
      type OGrafGraphic = HTMLElement & { load: OGrafAction; playAction: OGrafAction };
      const graphic = document.querySelector('baja-team-card') as OGrafGraphic;
      await graphic.load({
        data: { carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB' },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      const panel = graphic.shadowRoot?.querySelector('[data-testid="team-card-panel"]');
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
