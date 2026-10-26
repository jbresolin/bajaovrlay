/**
 * Bracket lifecycle, driven like a renderer (packages/graphics/bracket, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in "main",
 *   registers its default export as a custom element and then calls load, playAction (once
 *   per step), updateAction, stopAction and dispose on it. These tests do exactly that
 *   against the BUILT graphic (dist/), served under /graphics/bracket/ as the server will
 *   serve it, in Chromium (the engine inside OBS), with the theme's tokens on the page; and
 *   they press the preview's buttons to watch the pieces from the outside.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/bracket/: manifest, module and styles load.
 *   - load → play ×7 → update → play (the end) → dispose each resolve with 200, the plays
 *     reporting the real Super Prime's steps 0 to 6 and then none.
 *   - What is on screen never moves: the first quarter-final's box is the same at every
 *     later step of the tree, as the semifinals, the third place and the final come.
 *   - A renderer reloaded at a step (a goto from off air, with no animation) draws that step
 *     exactly as the steps pressed one by one did: the same boxes, the same lines.
 *   - A board's step is animated: once its first card has started to rise, the last is
 *     still on its way.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps are done by hand, following
 *     the OGraf v1 spec. The control page's walk with the server is apps/control's
 *     bracketStepsWithTheSimulator.e2e.ts.
 *   - What the bracket looks like: bracketScreenshots.e2e.ts covers that.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { expect, type Page, test } from '@playwright/test';

/** The real Super Prime's rounds, from the shared sample, as a binding hands them over. */
function readTheRealSuperPrimeData(): unknown {
  const resolveLikeNode = createRequire(import.meta.url);
  const samplePath = resolveLikeNode.resolve(
    '@bajaovrlay/shared/samples/brackets.super-prime.json',
  );
  const sample = JSON.parse(readFileSync(samplePath, 'utf8')) as { rounds: unknown };
  return { rounds: sample.rounds, title: 'SUPER PRIME' };
}

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: read the
 * manifest, import "main", register the default export and put one element on the page.
 * No theme is on this page: the lifecycle's answers do not depend on it.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('bracket.ograf.json');
  return page.evaluate(async () => {
    const manifestResponse = await fetch('bracket.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-bracket', graphicModule.default);
    document.body.append(document.createElement('baja-bracket'));
    return manifest.id;
  });
}

/** Waits until the last preview action has answered with the bracket on air. */
async function waitUntilOnAir(page: Page): Promise<void> {
  await expect(page.locator('body'), 'the bracket must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
}

/** Each tree match's place on the page by its match id, and the count of its lines. */
async function measureTheTree(page: Page) {
  const matchPlaces = await page.getByTestId('bracket-tree-match').evaluateAll((matches) =>
    Object.fromEntries(
      matches.map((match) => {
        const box = match.getBoundingClientRect();
        const place = `${String(Math.round(box.x))},${String(Math.round(box.y))}`;
        return [(match as HTMLElement).dataset.matchId ?? '', place];
      }),
    ),
  );
  const lineCount = await page.getByTestId('bracket-tree-line').count();
  return { matchPlaces, lineCount };
}

test.describe('the bracket driven like a renderer', () => {
  test('resolves load, the seven steps, update, the end and dispose', async ({ page }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the lifecycle with the real Super Prime, noting each answer.
    const answers = await page.evaluate(async (superPrime) => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-bracket') as OGrafGraphic;
      const noted: { action: string; statusCode: number; currentStep?: number }[] = [];
      const loadAnswer = await graphic.load({
        data: superPrime,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      noted.push({ action: 'load', statusCode: loadAnswer.statusCode });
      for (let press = 0; press < 7; press += 1) {
        noted.push({ action: 'play', ...(await graphic.playAction({ skipAnimation: true })) });
      }
      const updateAnswer = await graphic.updateAction({ data: { title: 'SUPER PRIME · 30ª' } });
      noted.push({ action: 'update', statusCode: updateAnswer.statusCode });
      noted.push({ action: 'play', ...(await graphic.playAction({ skipAnimation: true })) });
      const disposeAnswer = await graphic.dispose({});
      noted.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return noted;
    }, readTheRealSuperPrimeData());

    // Assert: the manifest was read; every call answered 200, the steps 0 to 6, then none.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-bracket');
    expect(answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      ...Array.from({ length: 7 }, (_unused, step) => ({
        action: 'play',
        statusCode: 200,
        currentStep: step,
      })),
      { action: 'update', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: undefined },
      { action: 'dispose', statusCode: 200 },
    ]);
  });

  test('never moves what is on screen as the tree grows, and draws a reloaded step the same', async ({
    page,
  }) => {
    // Arrange: the preview's Super Prime on air, Próximo pressed to the tree's first step.
    await page.goto('preview.html');
    await waitUntilOnAir(page);
    const next = page.getByRole('button', { name: 'Próximo' });
    for (let press = 1; press < 4; press += 1) {
      await next.click();
      await waitUntilOnAir(page);
    }

    // Act: note the tree at each of its steps; then reload the page and take it straight
    // to the final with no animation, as a renderer reloaded at that step does.
    const treeAtEachStep = [await measureTheTree(page)];
    for (let press = 4; press < 7; press += 1) {
      await next.click();
      await waitUntilOnAir(page);
      treeAtEachStep.push(await measureTheTree(page));
    }
    await page.goto('preview.html');
    await waitUntilOnAir(page);
    await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & { playAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-bracket') as OGrafGraphic;
      await graphic.playAction({ goto: 6, skipAnimation: true });
    });
    const treeAfterTheReload = await measureTheTree(page);

    // Assert: each step keeps every match of the one before where it was; the reloaded
    // final is the final pressed to.
    for (let stepIndex = 1; stepIndex < treeAtEachStep.length; stepIndex += 1) {
      const placesBefore = treeAtEachStep[stepIndex - 1]?.matchPlaces ?? {};
      expect(
        treeAtEachStep[stepIndex]?.matchPlaces,
        'no match already on screen may move',
      ).toMatchObject(placesBefore);
    }
    expect(
      treeAtEachStep.map((tree) => tree.lineCount),
      'the lines come with their rounds',
    ).toEqual([0, 4, 4, 6]);
    expect(treeAfterTheReload, 'a reload at the final draws the final').toEqual(treeAtEachStep[3]);
  });

  test('animates a board’s cascade instead of snapping', async ({ page }) => {
    // Arrange: the preview's Super Prime on air at its first board, then each piece's rise
    // made ten seconds long, so the cascade is surely still running when the test looks.
    await page.goto('preview.html');
    await waitUntilOnAir(page);
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--motion-in', '10000ms');
    });
    const cards = page.getByTestId('bracket-match-card');
    const readOpacityOfCard = (cardIndex: number) =>
      cards.nth(cardIndex).evaluate((card) => Number(getComputedStyle(card).opacity));

    // Act: press Próximo, and wait for the 16 avos' first card to start rising.
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(cards, 'the 16 avos are drawn').toHaveCount(16);
    await expect
      .poll(() => readOpacityOfCard(0), { message: 'the first card starts to rise' })
      .toBeGreaterThan(0);
    const opacityOfTheLastCard = await readOpacityOfCard(15);

    // Assert: the last card, 15 staggers behind, is still on its way.
    expect(opacityOfTheLastCard, 'the last card is still on its way').toBeLessThan(1);
  });
});
