/**
 * Lower strip screenshots, page 1 with and without the clock block, on two stages
 * (packages/graphics/lower-strip, Playwright)
 *
 * What this module is for:
 *   The strip's look in Ardósia is pinned by screenshots of the built preview.html (the
 *   theme's tokens and font) at 1920x1080 on the design's grey and black stages, against
 *   the baselines stored next to this file. The design it must match is
 *   docs/design/directions/ardosia/lower-strip.html (screenshots/lower-strip.*.jpg): page 1
 *   of the real enduro, the clock held at 1:00:00 under the green flag.
 *
 * What these tests prove:
 *   - Page 1 with the clock block ("1:00:00", VERDE, six cars, "1/6") and without it (the
 *     cars from the left of the bar) draw like their baselines.
 *
 * What these tests deliberately do not cover:
 *   - The car names: the design names a team by its short name; the strip shows the
 *     school's short name, as the brief asks, from the positions source.
 *   - Motion and the other pages; lowerStripLifecycle.e2e.ts and lowerStripFitsTheBar.e2e.ts.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/lower-strip test:e2e --update-snapshots`.
 */
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, test } from '@playwright/test';

const variants = [
  // The design's lower-strip page.
  { slug: 'com-relogio', query: '' },
  // The race clock card is up, so the strip leaves out its block.
  { slug: 'sem-relogio', query: '&clock=off' },
];

test.describe('the lower strip looks like its baseline', () => {
  for (const variant of variants) {
    for (const stage of ['grey', 'black'] as const) {
      test(`page 1 ${variant.slug} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the built preview on this stage (the clock held, a school too long for its
        // pill held at its start: BAJAOVRLAY-55), on air with its face.
        await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensHoldingAtTheStart);
        await page.goto(`preview.html?stage=${stage}${variant.query}`);
        await expect(page.locator('body'), 'the strip must be on air').toHaveAttribute(
          'data-preview-state',
          'onAir',
        );
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        // Act: hide the preview's own buttons, which are not on air.
        await page.locator('#preview-controls').evaluate((controls) => {
          controls.style.visibility = 'hidden';
        });

        // Assert: page 1 and its look against the baseline (1% tolerance for anti-aliasing).
        await expect(page.getByTestId('lower-strip-page-cell'), 'page 1 is shown').toHaveText(
          '1/6',
        );
        await expect(
          page,
          `the strip ${variant.slug} must look like its baseline on ${stage}`,
        ).toHaveScreenshot(`lower-strip-${variant.slug}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});
