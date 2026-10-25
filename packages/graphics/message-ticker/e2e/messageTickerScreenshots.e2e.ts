/**
 * Message ticker screenshots, with and without the clock block, on two stages
 * (packages/graphics/message-ticker, Playwright)
 *
 * What this module is for:
 *   The ticker's look in Ardósia is pinned by screenshots of the built preview.html (the
 *   theme's tokens and font) at 1920x1080 on the design's grey and black stages, against
 *   the baselines stored next to this file. The design it must match is
 *   docs/design/directions/ardosia/message-ticker.html (screenshots/message-ticker.*.jpg):
 *   "AVISO" and "Largada do enduro às 10h00", the clock held at 1:00:00 under the green flag.
 *
 * What these tests prove:
 *   - The ticker with the clock block (the block, the label, the message, "1/3") and
 *     without it (the label starting the bar) draws like its baselines.
 *
 * What these tests deliberately do not cover:
 *   - Motion and the other messages; messageTickerLifecycle.e2e.ts.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/message-ticker test:e2e --update-snapshots`.
 */
import { expect, test } from '@playwright/test';

const variants = [
  // The design's message-ticker page.
  { slug: 'com-relogio', query: '' },
  // Between sessions: the label starts the bar.
  { slug: 'sem-relogio', query: '&clock=off' },
];

test.describe('the message ticker looks like its baseline', () => {
  for (const variant of variants) {
    for (const stage of ['grey', 'black'] as const) {
      test(`${variant.slug} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the built preview on this stage (the clock held), on air with its face.
        await page.goto(`preview.html?stage=${stage}${variant.query}`);
        await expect(page.locator('body'), 'the ticker must be on air').toHaveAttribute(
          'data-preview-state',
          'onAir',
        );
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        // Act: hide the preview's own buttons, which are not on air.
        await page.locator('#preview-controls').evaluate((controls) => {
          controls.style.visibility = 'hidden';
        });

        // Assert: the first message and its look against the baseline (1% tolerance for
        // anti-aliasing).
        await expect(page.getByTestId('message-ticker-page-cell'), 'the first message').toHaveText(
          '1/3',
        );
        await expect(
          page,
          `the ticker ${variant.slug} must look like its baseline on ${stage}`,
        ).toHaveScreenshot(`message-ticker-${variant.slug}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
