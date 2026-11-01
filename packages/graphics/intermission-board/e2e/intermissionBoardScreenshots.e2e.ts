/**
 * Intermission board screenshots (packages/graphics/intermission-board, Playwright)
 *
 * What this module is for:
 *   The board's look in Ardósia, pinned by screenshots of the built preview.html at
 *   1920x1080, against the baselines beside this file. The design it must match is
 *   docs/design/directions/ardosia/intermission-board.html (screenshots/intermission-board.*)
 *   at the design's moment, 23:45 before the enduro, with the real top five and the
 *   Diamante page of the sponsor line; the combinations without the top five follow the
 *   motion demos `motion-intermission-sem-classificacao-*`.
 *
 * What these tests prove:
 *   - The full board draws like its baselines on the grey and black stages; without the top
 *     five (with and without sponsors) on grey, the next session across the width.
 *   - The board is --board-width (1280 px) wide and centred; the count reads 23:45.
 *
 * What these tests deliberately do not cover:
 *   - Motion and the line's turns; the lifecycle e2e and the component tests. A text too
 *     long for its box is held at its start (BAJAOVRLAY-55: cut at its box's edge, no fade). After a
 *     deliberate visual change, refresh with `… test:e2e --update-snapshots=all`.
 */
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** 09:36:15 on Sunday 30 March 2025 in Brasília: the design's 23:45 before the start. */
const designsMomentMs = Date.parse('2025-03-30T09:36:15.000-03:00');

/** The enduro's start, which the preview takes from the address. */
const enduroStartsAtMs = Date.parse('2025-03-30T10:00:00.000-03:00');

/**
 * Opens the preview on air at the design's moment: the start fixed by the address, the
 * page's clock run from ten seconds before (GSAP reads it) and paused half a second after
 * the moment once on air; the holds are a day long, so the line never turns during the
 * shot, and a long text holds at its start; the logos and the face loaded; the page's buttons hidden.
 */
async function openPreviewOnAirAtTheDesignsMoment(page: Page, address: string): Promise<void> {
  const oneDayMs = '86400000ms';
  await placeTokenOverridesBeforeTheGraphicLoads(page, {
    '--motion-sponsor-hold': oneDayMs,
    '--motion-sponsor-hold-diamante': oneDayMs,
    ...textTokensHoldingAtTheStart,
  });
  await page.clock.install({ time: designsMomentMs - 10_000 });
  await page.goto(`${address}&nextStartsAtMs=${String(enduroStartsAtMs)}`);
  await expect(page.locator('body'), 'the board must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.clock.pauseAt(designsMomentMs + 500);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => {
    const board = document.querySelector('baja-intermission-board');
    const images = [...(board?.shadowRoot?.querySelectorAll('img') ?? [])];
    return images.every((image) => image.complete && image.naturalWidth > 0);
  });
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

const variants = [
  // The design's page, on both stages.
  { slug: 'completo', query: '', stages: ['grey', 'black'] as const },
  // Before the first standings: the next session across the width, the line under it.
  { slug: 'sem-classificacao', query: '&topFive=off', stages: ['grey'] as const },
  // The next session alone.
  {
    slug: 'sem-classificacao-sem-patrocinadores',
    query: '&topFive=off&sponsors=off',
    stages: ['grey'] as const,
  },
];

test.describe('the intermission board looks like its baseline', () => {
  for (const variant of variants) {
    for (const stage of variant.stages) {
      test(`${variant.slug} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the board on air at the design's moment.
        await openPreviewOnAirAtTheDesignsMoment(
          page,
          `preview.html?stage=${stage}${variant.query}`,
        );

        // Act: measure the board.
        const boardBox = await page.getByTestId('intermission-board').boundingBox();

        // Assert: centred and 1280 wide, the count, and the look.
        expect({ left: boardBox?.x, width: boardBox?.width }, 'the narrow board, centred').toEqual({
          left: 320,
          width: 1280,
        });
        await expect(page.getByTestId('intermission-count'), 'the design’s count').toHaveText(
          '23:45',
        );
        await expect(
          page,
          `${variant.slug} must look like its baseline on ${stage}`,
        ).toHaveScreenshot(`intermission-board-${variant.slug}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
