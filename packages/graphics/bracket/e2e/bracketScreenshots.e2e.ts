/**
 * Bracket screenshots on the design's grey and black stages (packages/graphics/bracket,
 * Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the bracket in Ardósia is
 *   pinned by screenshots of preview.html (the theme's tokens and font loaded as on air) at
 *   1920×1080, compared against the baselines stored next to this file. The design they
 *   must match, side by side: docs/design/directions/ardosia/bracket-passo-1.html to -7.html
 *   and sheet-bracket-results.html, and their screenshots/*.grey.jpg and *.black.jpg (PR #21).
 *
 * What these tests prove, on the grey (#7f7f7f) and the black (#0a0a0a) stage each:
 *   - The real Super Prime's seven steps, bracket-passo-1 to -7: the 32 avos (31 byes and
 *     Corisco × Buffalo), the 16 avos, the oitavas, then the tree from the quarter-finals to
 *     the final, the third place under the final the step before it; the head's round name
 *     on the boards and its step line "1/7" to "7/7".
 *   - The six result states of sheet-bracket-results, on a round board and in the tree.
 *   - On the boards, the cards stand where the design draws them: the first at x 96..940,
 *     y 126..166, the right column from x 980; in the tree the first quarter-final's top car
 *     at y 224 and the final's column from x 1312.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the shots show the end of each step's cascade. A team too long for its card
 *     is held at its start (BAJAOVRLAY-55: cut at its box's edge, no fade).
 *   - The design's frame-1 shots over footage; the grey and black stages are compared.
 *   - Other operating systems: baselines are rendered on Linux. After a deliberate visual
 *     change, refresh them with `pnpm --filter @bajaovrlay/bracket test:e2e --update-snapshots`.
 */
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** Waits until the last preview action has answered with the bracket on air. */
async function waitUntilOnAir(page: Page): Promise<void> {
  await expect(page.locator('body'), 'the bracket must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
}

/**
 * Opens a preview sample on the stage, a long team held at its start, and waits for its
 * first step and the font.
 */
async function openPreviewOnAir(page: Page, query: string): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensHoldingAtTheStart);
  await page.goto(`preview.html?${query}`);
  await waitUntilOnAir(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Presses Próximo and waits for the step's motion to end. */
async function pressNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Próximo' }).click();
  await waitUntilOnAir(page);
}

/** Hides the preview's buttons, which are not on air. */
async function hidePreviewControls(page: Page): Promise<void> {
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.display = 'none';
  });
}

/** The box of the element at `index` (the first by default), rounded, edges named. */
async function measureFirst(page: Page, selector: string, index = 0) {
  const box = await page.locator(selector).nth(index).boundingBox();
  return {
    left: Math.round(box?.x ?? 0),
    right: Math.round((box?.x ?? 0) + (box?.width ?? 0)),
    top: Math.round(box?.y ?? 0),
    bottom: Math.round((box?.y ?? 0) + (box?.height ?? 0)),
  };
}

const superPrimeSteps = [
  // bracket-passo-1: the 32 avos, 31 byes and one race, "1/7".
  { stepNumber: 1, designPage: 'bracket-passo-1' },
  // bracket-passo-2: the 16 avos, plain wins.
  { stepNumber: 2, designPage: 'bracket-passo-2' },
  // bracket-passo-3: the oitavas, eight cards.
  { stepNumber: 3, designPage: 'bracket-passo-3' },
  // bracket-passo-4: the tree's first step, every round name, the quarter-finals.
  { stepNumber: 4, designPage: 'bracket-passo-4' },
  // bracket-passo-5: the semifinals and their lines.
  { stepNumber: 5, designPage: 'bracket-passo-5' },
  // bracket-passo-6: the third place under the final's column.
  { stepNumber: 6, designPage: 'bracket-passo-6' },
  // bracket-passo-7: the final and its lines.
  { stepNumber: 7, designPage: 'bracket-passo-7' },
] as const;

const stages = ['grey', 'black'];

test.describe('the real Super Prime looks like bracket-passo-1 to -7', () => {
  for (const { stepNumber, designPage } of superPrimeSteps) {
    for (const stage of stages) {
      test(`step ${String(stepNumber)} (${designPage}) on the ${stage} stage`, async ({ page }) => {
        // Arrange: the Super Prime on air, Próximo pressed up to the step, buttons hidden.
        await openPreviewOnAir(page, `stage=${stage}`);
        for (let press = 1; press < stepNumber; press += 1) {
          await pressNext(page);
        }
        await hidePreviewControls(page);

        // Act: read the head's step line.
        const stepLine = await page.getByTestId('bracket-page-line').textContent();

        // Assert: the step line, and the whole stage against its baseline. A 1% pixel
        // tolerance absorbs anti-aliasing between GPU drivers without letting a colour or
        // a text change through.
        expect(stepLine, 'the head counts the step of seven').toBe(`${String(stepNumber)}/7`);
        await expect(
          page,
          `the Super Prime at step ${String(stepNumber)} (${stage})`,
        ).toHaveScreenshot(`bracket-step-${String(stepNumber)}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }

  test('stands the board’s cards and the tree’s pills where the design draws them', async ({
    page,
  }) => {
    // Arrange: the Super Prime on air at its first step.
    await openPreviewOnAir(page, 'stage=grey');

    // Act: measure the first card of each column, then go to the final and measure the tree.
    const firstCard = await measureFirst(page, '[data-testid="bracket-match-card"]');
    // The 17th card is the right column's first: the grid fills the left column's 16 first.
    const firstCardOfTheRightColumn = await measureFirst(
      page,
      '[data-testid="bracket-match-card"]',
      16,
    );
    for (let press = 1; press < 7; press += 1) {
      await pressNext(page);
    }
    const firstQuarterFinal = await measureFirst(page, '[data-testid="bracket-tree-match"]');
    const final = await measureFirst(page, '[data-testid="bracket-tree-match"][data-column="2"]');

    // Assert: bracket-passo-1's and -7's boxes.
    expect(firstCard, 'the first card, top left of the board').toEqual({
      left: 96,
      right: 940,
      top: 126,
      bottom: 166,
    });
    expect(firstCardOfTheRightColumn.left, 'the right column after the 40 px gutter').toBe(980);
    expect(firstQuarterFinal, 'the first quarter-final under the name pills').toMatchObject({
      left: 96,
      right: 608,
      top: 224,
    });
    expect(final.left, 'the final’s column').toBe(1312);
  });
});

const resultSheets = [
  // The six states on a round board: one page, six cards.
  { query: 'results=board', presses: 0, name: 'bracket-results-board' },
  // The six states in the tree: the quarter-finals, then the bye and the undecided match.
  { query: 'results=tree', presses: 1, name: 'bracket-results-tree' },
];

test.describe('the six result states look like sheet-bracket-results', () => {
  for (const { query, presses, name } of resultSheets) {
    for (const stage of stages) {
      test(`${name} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the sample on air, at its last step, buttons hidden.
        await openPreviewOnAir(page, `${query}&stage=${stage}`);
        for (let press = 0; press < presses; press += 1) {
          await pressNext(page);
        }
        await hidePreviewControls(page);

        // Act: nothing more; the states are on screen.

        // Assert: the stage against its baseline.
        await expect(page, `${name} (${stage})`).toHaveScreenshot(`${name}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
