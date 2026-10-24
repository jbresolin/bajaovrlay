/**
 * Standings lifecycle, driven like a renderer (packages/graphics/standings, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in "main",
 *   registers its default export as a custom element and calls load, playAction,
 *   updateAction, stopAction and dispose on it. These tests do exactly that against the
 *   BUILT graphic (dist/), served under /graphics/standings/ as the server will serve it,
 *   in Chromium (the engine inside OBS).
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/standings/: manifest and module load.
 *   - load → play → update → stop → update → dispose each resolve, in order, with 200;
 *     play reports step 0, and stop resolves only once the board is off screen.
 *   - The live update on air is drawn in place: the first row shows the new leader and
 *     is still fully shown (no re-entry).
 *   - updateAction before load answers a 4xx status instead of throwing.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps are done by hand.
 *   - The look; standingsScreenshots.e2e.ts covers it.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: read the
 * manifest, import "main", register the default export and put one element on the page.
 * Returns the manifest's id so the test can check it was really read.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('standings.ograf.json');
  return page.evaluate(async () => {
    const manifestResponse = await fetch('standings.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-standings', graphicModule.default);
    document.body.append(document.createElement('baja-standings'));
    return manifest.id;
  });
}

/** The top three of the 30th competition, as the source sends them. */
function createTopThreeEntries() {
  return [
    { rank: 1, carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG', points: 921.8 },
    { rank: 2, carNumber: 1, teamName: 'Equipe FEI Baja', schoolName: 'FEI', points: 903.48 },
    {
      rank: 3,
      carNumber: 10,
      teamName: 'Equipe Komiketo Baja',
      schoolName: 'UFSJ',
      points: 891.59,
    },
  ];
}

test.describe('the standings driven like a renderer', () => {
  test('resolves load, play, update, stop, update and dispose in order, each with 200', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, noting each answer and what the board showed.
    const lifecycle = await page.evaluate(async (entries) => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        stopAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-standings') as OGrafGraphic;
      const findInGraphic = (testId: string) =>
        graphic.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];

      const loadAnswer = await graphic.load({
        data: { entries, title: 'CLASSIFICAÇÃO GERAL' },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const playAnswer = await graphic.playAction({});
      answers.push({ action: 'play', ...playAnswer });
      const newLeaderFirst = [{ ...entries[1], rank: 1 }, { ...entries[0], rank: 2 }, entries[2]];
      const updateAnswer = await graphic.updateAction({ data: { entries: newLeaderFirst } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const firstRow = findInGraphic('standings-row');
      const firstRowAfterTheUpdate = {
        carNumber: firstRow?.dataset.carNumber,
        opacity: firstRow ? getComputedStyle(firstRow).opacity : 'no row',
      };
      const stopAnswer = await graphic.stopAction({});
      const head = findInGraphic('standings-head');
      const headOpacityWhenStopResolved = head ? getComputedStyle(head).opacity : 'no head';
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const updateOffAirAnswer = await graphic.updateAction({ data: { eventLine: 'ENDURO' } });
      answers.push({ action: 'update off air', statusCode: updateOffAirAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, firstRowAfterTheUpdate, headOpacityWhenStopResolved };
    }, createTopThreeEntries());

    // Assert: the manifest was read, every call resolved in order with 200, the update was
    // drawn in place, and stop resolved only once the head card was invisible.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-standings');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'update off air', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(
      lifecycle.firstRowAfterTheUpdate,
      'the update on air must show the new leader in the first row, fully shown',
    ).toEqual({ carNumber: '1', opacity: '1' });
    expect(
      lifecycle.headOpacityWhenStopResolved,
      'stop must resolve only after the out animation has hidden the board',
    ).toBe('0');
  });

  test('answers a 4xx status, not an error, to updateAction before load', async ({ page }) => {
    // Arrange: the built graphic on the page, never loaded.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: send an update before load.
    const updateAnswer = await page.evaluate(async () => {
      type ActionAnswer = { statusCode: number; statusMessage?: string };
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<ActionAnswer> };
      const graphic = document.querySelector('baja-standings') as OGrafGraphic;
      return graphic.updateAction({ data: { title: 'CLASSIFICAÇÃO GERAL' } });
    });

    // Assert: a client-error status with a pt-BR explanation.
    expect(updateAnswer.statusCode, 'update before load must answer 4xx').toBeGreaterThanOrEqual(
      400,
    );
    expect(updateAnswer.statusCode, 'update before load must answer 4xx').toBeLessThan(500);
    expect(updateAnswer.statusMessage, 'the answer must explain itself in pt-BR').toBe(
      'A classificação ainda não foi carregada (load).',
    );
  });
});
