/**
 * Race clock lifecycle, driven like a renderer (packages/graphics/race-clock, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in
 *   "main", registers its default export as a custom element and then calls load,
 *   playAction, updateAction, stopAction and dispose on it. These tests do exactly that
 *   against the BUILT graphic (dist/), served under /graphics/race-clock/ as the server
 *   will serve it, in Chromium (the engine inside OBS).
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/race-clock/: manifest, module and assets load.
 *   - load → play → update → stop → dispose each resolve, in that order, with 200;
 *     play reports step 0, and stop resolves only once the graphic is off screen.
 *   - updateAction before playAction answers a 4xx status instead of throwing.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer), which does not load graphics yet;
 *     the steps above are done by hand, following the OGraf v1 spec.
 *   - What the graphic looks like; raceClockScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: read the
 * manifest, import "main", register the default export and put one element on the page.
 * Returns the manifest's id so the test can check it was really read.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('race-clock.ograf.json');
  return page.evaluate(async () => {
    const manifestResponse = await fetch('race-clock.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-race-clock', graphicModule.default);
    document.body.append(document.createElement('baja-race-clock'));
    return manifest.id;
  });
}

test.describe('the race clock driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, each with 200', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, waiting for each call before the next,
    // and note each answer in the order the calls resolved.
    const answersInOrder = await page.evaluate(async () => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafGraphic = HTMLElement & Record<string, (params: object) => Promise<ActionAnswer>>;
      const graphic = document.querySelector('baja-race-clock') as OGrafGraphic;
      const panel = graphic.shadowRoot?.querySelector('[data-testid="race-clock-panel"]');
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];

      const loadAnswer = await graphic.load({
        data: {
          sessionName: 'Enduro de Resistência',
          state: 'green',
          clockMode: 'elapsed',
          referenceTimeMs: 3_900_000,
          referenceWallClockMs: Date.now(),
          running: true,
          lapsCompletedByLeader: 12,
        },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const playAnswer = await graphic.playAction({});
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({ data: { state: 'yellow' } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const panelOpacityWhenStopResolved = panel ? getComputedStyle(panel).opacity : 'no panel';
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, panelOpacityWhenStopResolved };
    });

    // Assert: the manifest was read, every call resolved in order with 200, play
    // reported step 0, and stop resolved only once the panel was invisible.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-race-clock');
    expect(answersInOrder.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(
      answersInOrder.panelOpacityWhenStopResolved,
      'stop must resolve only after the out animation has hidden the graphic',
    ).toBe('0');
  });

  test('answers a 4xx status, not an error, to updateAction before playAction', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest and given its data.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: load it, then send an update before it was ever played.
    const updateAnswer = await page.evaluate(async () => {
      type ActionAnswer = { statusCode: number; statusMessage?: string };
      type OGrafGraphic = HTMLElement & Record<string, (params: object) => Promise<ActionAnswer>>;
      const graphic = document.querySelector('baja-race-clock') as OGrafGraphic;
      await graphic.load({
        data: {
          sessionName: 'Enduro de Resistência',
          state: 'green',
          clockMode: 'elapsed',
          referenceTimeMs: 0,
          referenceWallClockMs: Date.now(),
          running: false,
        },
        renderType: 'realtime',
        renderCharacteristics: {},
      });
      return graphic.updateAction({ data: { state: 'yellow' } });
    });

    // Assert: a client-error status with a pt-BR explanation, not a thrown error.
    expect(updateAnswer.statusCode, 'update before play must answer 4xx').toBeGreaterThanOrEqual(
      400,
    );
    expect(updateAnswer.statusCode, 'update before play must answer 4xx').toBeLessThan(500);
    expect(updateAnswer.statusMessage, 'the answer must explain itself in pt-BR').toBe(
      'O relógio não está no ar: chame playAction antes de atualizar.',
    );
  });
});
