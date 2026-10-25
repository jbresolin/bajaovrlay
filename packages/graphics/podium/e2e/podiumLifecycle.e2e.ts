/**
 * Podium lifecycle, driven like a renderer (packages/graphics/podium, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in "main",
 *   registers its default export as a custom element and then calls load, playAction (once
 *   per step), updateAction, stopAction and dispose on it. These tests do exactly that
 *   against the BUILT graphic (dist/), served under /graphics/podium/ as the server will
 *   serve it, in Chromium (the engine inside OBS), with the motion tokens on the page; and
 *   they press the preview's buttons to watch the cards from the outside.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/podium/: manifest, module and styles load.
 *   - load → play ×4 → update → play (the end) → dispose each resolve with 200, the plays
 *     reporting steps 0, 1, 2, 3 and then none (the step past the 1st takes it off air).
 *   - The reveal order: the head alone at step 0, then the 3rd, the 2nd and the 1st, each
 *     card fully shown once its step resolves and the others invisible.
 *   - A broken logo address never blocks: load still answers 200.
 *   - The cards never move: the box of each revealed card is the same at every later step,
 *     and the cards not yet revealed are hidden (visibility), never removed.
 *   - A step is animated: part way through, the card is part visible and still rising.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps are done by hand, following
 *     the OGraf v1 spec.
 *   - What the podium looks like; podiumScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('podium.ograf.json');
  return page.evaluate(async () => {
    // The renderer page links the theme's tokens.css; here the motion values the test
    // watches are placed by hand, with the Ardósia values.
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    document.documentElement.style.setProperty('--motion-podium-offset', '40');
    const manifestResponse = await fetch('podium.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-podium', graphicModule.default);
    document.body.append(document.createElement('baja-podium'));
    return manifest.id;
  });
}

/** Waits until the last preview action has answered with the podium in this state. */
async function waitForPreviewState(page: Page, previewState: string): Promise<void> {
  await expect(page.locator('body'), `the preview must be ${previewState}`).toHaveAttribute(
    'data-preview-state',
    previewState,
  );
}

/** The card of one slot on the preview page. */
function cardOfSlot(page: Page, slot: string) {
  return page.locator(`[data-testid="podium-card"][data-slot="${slot}"]`);
}

test.describe('the podium driven like a renderer', () => {
  test('resolves load, four plays, update, the end and dispose, revealing 3rd, 2nd, 1st', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the lifecycle with the enduro's three, Sinuelo's logo address
    // broken, noting each answer and, after each play, which slots are visible.
    const lifecycle = await page.evaluate(async () => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-podium') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const visibleAfterEachPlay: string[][] = [];
      const listVisibleSlots = () => {
        const cards = graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="podium-card"]',
        );
        return [...(cards ?? [])]
          .filter((card) => getComputedStyle(card).visibility === 'visible')
          .filter((card) => Number(getComputedStyle(card).opacity) === 1)
          .map((card) => card.dataset.slot ?? '');
      };

      const loadAnswer = await graphic.load({
        data: {
          entries: [
            {
              position: 1,
              carNumber: 51,
              teamName: 'Sinuelo',
              schoolName: 'FAHOR',
              logoUrl: '/media/logo-que-nao-existe',
            },
            { position: 2, carNumber: 10, teamName: 'Equipe Komiketo Baja', schoolName: 'UFSJ' },
            { position: 3, carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB' },
          ],
          eventLine: 'ENDURO DE RESISTÊNCIA',
        },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      for (let press = 0; press < 4; press += 1) {
        const playAnswer = await graphic.playAction({});
        answers.push({ action: 'play', ...playAnswer });
        visibleAfterEachPlay.push(listVisibleSlots());
      }
      const updateAnswer = await graphic.updateAction({ data: { title: 'PÓDIO · ENDURO' } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const endAnswer = await graphic.playAction({});
      answers.push({ action: 'play', ...endAnswer });
      const visibleAfterTheEnd = listVisibleSlots();
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, visibleAfterEachPlay, visibleAfterTheEnd };
    });

    // Assert: the manifest was read; every call answered 200 with the steps 0 to 3 and then
    // none; the head came alone, then the 3rd, the 2nd and the 1st; nothing is left after.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-podium');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'play', statusCode: 200, currentStep: 1 },
      { action: 'play', statusCode: 200, currentStep: 2 },
      { action: 'play', statusCode: 200, currentStep: 3 },
      { action: 'update', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: undefined },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.visibleAfterEachPlay, 'the reveal order must be 3rd, 2nd, 1st').toEqual([
      [],
      ['third'],
      ['second', 'third'],
      ['second', 'first', 'third'],
    ]);
    expect(lifecycle.visibleAfterTheEnd, 'the end takes every card off').toEqual([]);
  });

  test('keeps every revealed card in its box through the later steps', async ({ page }) => {
    // Arrange: the preview's enduro podium on air, the head alone.
    await page.goto('preview.html');
    await waitForPreviewState(page, 'onAir');
    const next = page.getByRole('button', { name: 'Próximo' });

    // Act: reveal the 3rd and note its box, then the 2nd, then the 1st, noting the boxes.
    await next.click();
    await waitForPreviewState(page, 'onAir');
    await expect(cardOfSlot(page, 'third'), 'the 3rd place is revealed').toBeVisible();
    const thirdAtStepOne = await cardOfSlot(page, 'third').boundingBox();
    await next.click();
    await waitForPreviewState(page, 'onAir');
    await expect(cardOfSlot(page, 'second'), 'the 2nd place is revealed').toBeVisible();
    const thirdAtStepTwo = await cardOfSlot(page, 'third').boundingBox();
    const secondAtStepTwo = await cardOfSlot(page, 'second').boundingBox();
    await expect(cardOfSlot(page, 'first'), 'the 1st place waits, hidden').toBeHidden();
    await next.click();
    await waitForPreviewState(page, 'onAir');
    await expect(cardOfSlot(page, 'first'), 'the 1st place is revealed').toBeVisible();
    const thirdAtStepThree = await cardOfSlot(page, 'third').boundingBox();
    const secondAtStepThree = await cardOfSlot(page, 'second').boundingBox();

    // Assert: the cards already shown never moved, and the logos are drawn.
    expect(thirdAtStepTwo, 'the 3rd place must not move when the 2nd comes').toEqual(
      thirdAtStepOne,
    );
    expect(thirdAtStepThree, 'the 3rd place must not move when the 1st comes').toEqual(
      thirdAtStepOne,
    );
    expect(secondAtStepThree, 'the 2nd place must not move when the 1st comes').toEqual(
      secondAtStepTwo,
    );
    await expect(page.getByTestId('podium-logo'), 'each team shows its logo').toHaveCount(3);
    await expect(page.getByTestId('podium-page-line'), 'the head counts 3/3').toHaveText('3/3');
  });

  test('animates a step instead of snapping: half way the card is part visible and rising', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest with one car, the head on air.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: press the step that brings the 3rd place, and look 150 ms into its 400 ms rise.
    const halfWay = await page.evaluate(async () => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number }>;
      type OGrafGraphic = HTMLElement & { load: OGrafAction; playAction: OGrafAction };
      const graphic = document.querySelector('baja-podium') as OGrafGraphic;
      await graphic.load({
        data: {
          entries: [
            { position: 1, carNumber: 51, teamName: 'Sinuelo', schoolName: 'FAHOR' },
            { position: 2, carNumber: 10, teamName: 'Equipe Komiketo Baja', schoolName: 'UFSJ' },
            { position: 3, carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB' },
          ],
        },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      await graphic.playAction({ skipAnimation: true });
      const thirdCard = graphic.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="podium-card"][data-slot="third"]',
      );
      const pendingStep = graphic.playAction({});
      await new Promise((resolve) => setTimeout(resolve, 150));
      const opacity = thirdCard ? Number(getComputedStyle(thirdCard).opacity) : -1;
      const transform = thirdCard ? getComputedStyle(thirdCard).transform : '';
      await pendingStep;
      return { opacity, transform };
    });

    // Assert: part visible, and still below its place (a translateY left in the matrix).
    expect(halfWay.opacity, 'half way the card must be part visible').toBeGreaterThan(0);
    expect(halfWay.opacity, 'half way the card must not be fully visible yet').toBeLessThan(1);
    expect(halfWay.transform, 'half way the card must still be rising').not.toBe('none');
  });
});
