/**
 * Battle card lifecycle, driven like a renderer and from the preview
 * (packages/graphics/battle-card, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in
 *   "main", registers its default export as a custom element and then calls load,
 *   playAction, updateAction, stopAction and dispose on it. These tests do exactly that
 *   against the BUILT graphic (dist/), served under /graphics/battle-card/ as the server
 *   will serve it, in Chromium (the engine inside OBS), and press the preview's
 *   "Atualizar" the way an operator watching the preview would.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/battle-card/: manifest, module and styles load.
 *   - load → play → update → stop → dispose each resolve, in order, with 200; play
 *     reports step 0; the three pieces are invisible before play, visible when it
 *     resolves, and gone when stop resolves.
 *   - The play-in is staggered: part way through, the car ahead is further in than the
 *     car behind.
 *   - On the preview, each "Atualizar" is the next lap: the gap changes in place and the
 *     trend goes "ABRINDO +1,0", "FECHANDO −1,0", and then, with the word kept,
 *     "FECHANDO −2,7" after "FECHANDO −2,0".
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps are done by hand, following
 *     the OGraf v1 spec.
 *   - What the card looks like; battleCardScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('battle-card.ograf.json');
  return page.evaluate(async () => {
    // The renderer page links the theme's tokens.css; here the motion values the test
    // watches are placed by hand, with the Ardósia values.
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-lead', '100ms');
    document.documentElement.style.setProperty('--motion-flag', '300ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifestResponse = await fetch('battle-card.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-battle-card', graphicModule.default);
    document.body.append(document.createElement('baja-battle-card'));
    return manifest.id;
  });
}

/** Imperador (8) 4th ahead of Equipe FEI Baja (1) 5th, 2,0 s apart at lap 1. */
const imperadorAheadOfFei = {
  aheadPosition: 4,
  aheadCarNumber: 8,
  aheadTeamName: 'Imperador',
  aheadSchoolName: 'UTFPR-CWB',
  aheadLaps: 1,
  behindPosition: 5,
  behindCarNumber: 1,
  behindTeamName: 'Equipe FEI Baja',
  behindSchoolName: 'FEI',
  behindLaps: 1,
  gapMs: 2000,
};

test.describe('the battle card driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, waiting for each call before the next, and note
    // each answer and how visible the three pieces are.
    const lifecycle = await page.evaluate(async (data) => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        stopAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-battle-card') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const readPieceOpacities = () =>
        ['battle-card-ahead', 'battle-card-gap-card', 'battle-card-behind'].map((testId) => {
          const piece = graphic.shadowRoot?.querySelector(`[data-testid="${testId}"]`);
          return piece ? Number(getComputedStyle(piece).opacity) : -1;
        });

      const loadAnswer = await graphic.load({
        data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacitiesBeforePlay = readPieceOpacities();
      const playAnswer = await graphic.playAction({});
      const opacitiesWhenPlayResolved = readPieceOpacities();
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({
        data: { aheadLaps: 2, behindLaps: 2, gapMs: 1300 },
      });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacitiesWhenStopResolved = readPieceOpacities();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, opacitiesBeforePlay, opacitiesWhenPlayResolved, opacitiesWhenStopResolved };
    }, imperadorAheadOfFei);

    // Assert: the manifest was read, every call resolved in order with 200, play reported
    // step 0, the pieces came in and went out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-battle-card');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacitiesBeforePlay, 'a loaded card must be invisible').toEqual([0, 0, 0]);
    expect(lifecycle.opacitiesWhenPlayResolved, 'play resolves with all in').toEqual([1, 1, 1]);
    expect(lifecycle.opacitiesWhenStopResolved, 'stop resolves with all out').toEqual([0, 0, 0]);
  });

  test('brings the car ahead in before the car behind', async ({ page }) => {
    // Arrange: the built graphic, loaded and waiting off air.
    await loadGraphicFromItsManifestLikeARenderer(page);
    await page.evaluate(async (data) => {
      const graphic = document.querySelector('baja-battle-card') as HTMLElement & {
        load: (params: object) => Promise<unknown>;
      };
      await graphic.load({
        data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
    }, imperadorAheadOfFei);

    // Act: start the play-in and, at the first frame where the car ahead is showing at
    // all, read both pills' opacity (frames, not a timer, so a slow machine reads the same).
    const opacitiesPartWay = await page.evaluate(async () => {
      const graphic = document.querySelector('baja-battle-card') as HTMLElement & {
        playAction: (params: object) => Promise<unknown>;
      };
      const readOpacity = (testId: string) => {
        const piece = graphic.shadowRoot?.querySelector(`[data-testid="${testId}"]`);
        return piece ? Number(getComputedStyle(piece).opacity) : -1;
      };
      const pendingPlay = graphic.playAction({});
      while (readOpacity('battle-card-ahead') === 0) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const opacities = {
        ahead: readOpacity('battle-card-ahead'),
        behind: readOpacity('battle-card-behind'),
      };
      await pendingPlay;
      return opacities;
    });

    // Assert: the car behind (two leads later) has not started when the car ahead shows.
    expect(
      opacitiesPartWay.ahead,
      'the car ahead must be further in than the car behind',
    ).toBeGreaterThan(opacitiesPartWay.behind);
  });
});

test.describe('the battle card preview, lap by lap', () => {
  test('changes the gap in place and the trend with each lap', async ({ page }) => {
    // Arrange: the preview on air with the sample battle at lap 1.
    await page.goto('preview.html');
    await expect(page.locator('body'), 'the card must be on air').toHaveAttribute(
      'data-preview-state',
      'onAir',
    );
    const gap = page.getByTestId('battle-card-gap');
    const trendWords = page.getByTestId('battle-card-trend-words');
    const updateButton = page.getByRole('button', { name: 'Atualizar (próxima volta)' });
    await expect(trendWords, 'the first reading has no trend number').toHaveText('ESTÁVEL');

    // Act and assert: each press is the next lap; the page settles on air between them.
    const lapsExpected = [
      { gap: '+3,0', trend: 'ABRINDO +1,0' },
      { gap: '+2,0', trend: 'FECHANDO −1,0' },
      { gap: '+13,0', trend: 'ABRINDO +11,0' },
      { gap: '+11,0', trend: 'FECHANDO −2,0' },
      { gap: '+8,3', trend: 'FECHANDO −2,7' },
    ];
    for (const lap of lapsExpected) {
      await updateButton.click();
      await expect(gap, `the gap must read ${lap.gap}`).toHaveText(lap.gap);
      await expect(trendWords, `the trend must read ${lap.trend}`).toHaveText(lap.trend);
      await expect(page.locator('body'), 'still on air').toHaveAttribute(
        'data-preview-state',
        'onAir',
      );
    }
  });
});
