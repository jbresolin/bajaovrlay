/**
 * Positions tower lifecycle, driven like a renderer (packages/graphics/positions-tower, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in
 *   "main", registers its default export as a custom element and then calls load,
 *   playAction, updateAction, stopAction and dispose on it. These tests do exactly that
 *   against the BUILT graphic (dist/), served under /graphics/positions-tower/ as the
 *   server will serve it, in Chromium (the engine inside OBS).
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/positions-tower/: manifest and module load.
 *   - load → play → update → stop → update → dispose each resolve, in that order, with
 *     200; play reports step 0, stop resolves only once the graphic is off screen, and
 *     an update after stop is accepted (updates are fine once loaded).
 *   - updateAction before load answers a 4xx status instead of throwing.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps above are done by hand,
 *     following the OGraf v1 spec.
 *   - What the graphic looks like; positionsTowerScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: read the
 * manifest, import "main", register the default export and put one element on the page.
 * Returns the manifest's id so the test can check it was really read.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('positions-tower.ograf.json');
  return page.evaluate(async () => {
    const manifestResponse = await fetch('positions-tower.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-positions-tower', graphicModule.default);
    document.body.append(document.createElement('baja-positions-tower'));
    return manifest.id;
  });
}

/** The top three of the enduro, as a renderer would send them. */
function createTopThreeEntries() {
  return [
    {
      position: 1,
      carNumber: 31,
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      laps: 34,
      status: 'running',
    },
    {
      position: 2,
      carNumber: 38,
      teamName: 'Coruja Racing',
      schoolName: 'EESC-USP',
      laps: 34,
      gapToLeaderMs: 19_087,
      status: 'running',
    },
    {
      position: 3,
      carNumber: 25,
      teamName: 'Bem-te-vi Off-Road',
      schoolName: 'UFES',
      laps: 33,
      gapToLeaderLaps: 1,
      status: 'running',
    },
  ];
}

test.describe('the positions tower driven like a renderer', () => {
  test('resolves load, play, update, stop, update and dispose in order, each with 200', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, waiting for each call before the next,
    // and note each answer in the order the calls resolved.
    const answersInOrder = await page.evaluate(async (entries) => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        stopAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-positions-tower') as OGrafGraphic;
      const head = graphic.shadowRoot?.querySelector('[data-testid="positions-tower-head"]');
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];

      const loadAnswer = await graphic.load({
        data: { entries, layout: 'compact' },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const playAnswer = await graphic.playAction({});
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({ data: { layout: 'detailed' } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const headOpacityWhenStopResolved = head ? getComputedStyle(head).opacity : 'no head';
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const updateOffAirAnswer = await graphic.updateAction({ data: { layout: 'compact' } });
      answers.push({ action: 'update off air', statusCode: updateOffAirAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, headOpacityWhenStopResolved };
    }, createTopThreeEntries());

    // Assert: the manifest was read, every call resolved in order with 200, play
    // reported step 0, and stop resolved only once the head was invisible.
    expect(manifestId, 'the renderer must have read the built manifest').toBe(
      'baja-positions-tower',
    );
    expect(answersInOrder.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'update off air', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(
      answersInOrder.headOpacityWhenStopResolved,
      'stop must resolve only after the out animation has hidden the graphic',
    ).toBe('0');
  });

  test('answers a 4xx status, not an error, to updateAction before load', async ({ page }) => {
    // Arrange: the built graphic, loaded from its manifest onto the page but never
    // given its data with load.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: send an update before load.
    const updateAnswer = await page.evaluate(async () => {
      type ActionAnswer = { statusCode: number; statusMessage?: string };
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<ActionAnswer> };
      const graphic = document.querySelector('baja-positions-tower') as OGrafGraphic;
      return graphic.updateAction({ data: { layout: 'detailed' } });
    });

    // Assert: a client-error status with a pt-BR explanation, not a thrown error.
    expect(updateAnswer.statusCode, 'update before load must answer 4xx').toBeGreaterThanOrEqual(
      400,
    );
    expect(updateAnswer.statusCode, 'update before load must answer 4xx').toBeLessThan(500);
    expect(updateAnswer.statusMessage, 'the answer must explain itself in pt-BR').toBe(
      'A torre ainda não foi carregada (load).',
    );
  });
});
