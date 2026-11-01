/**
 * Sponsor bug screenshots, with and without a sponsor, on two stages
 * (packages/graphics/sponsor-bug, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the bug's look in Ardósia is pinned
 *   by screenshots of the built preview.html (the theme's tokens and font, as the renderer
 *   page loads them) at 1920x1080, on the design's grey and black stages, compared with the
 *   baselines stored next to this file. The design they must match is
 *   docs/design/directions/ardosia/sponsor-bug.html (screenshots/sponsor-bug.grey.jpg and
 *   .black.jpg), here with Bosch's logo, as there.
 *
 * What these tests prove:
 *   - The bug with its sponsor ("ENDURO", "APRESENTADO POR", the logo on its light plate)
 *     and without (the mark and the word alone, no empty cell) draw like their baselines.
 *   - The card sits in the bug's slot: x 96 to 428, top at y 54.
 *   - The logo is a real file of the package, loaded before the shot.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the screenshots show the end of the play-in (sponsorBugLifecycle.e2e.ts
 *     covers in and out).
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/sponsor-bug test:e2e --update-snapshots`.
 */
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the preview on air and waits for the face and every image of the bug (never a
 * timer). A word too long for the card is held at its start (BAJAOVRLAY-55), so no scroll
 * lands in the shot.
 */
async function openPreviewOnAirWithImagesLoaded(page: Page, address: string): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensHoldingAtTheStart);
  await page.goto(address);
  await expect(page.locator('body'), 'the bug must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => {
    const sponsorBug = document.querySelector('baja-sponsor-bug');
    const images = [...(sponsorBug?.shadowRoot?.querySelectorAll('img') ?? [])];
    return images.every((image) => image.complete && image.naturalWidth > 0);
  });
  // The preview's own buttons are not on air.
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

const variants = [
  // The design's sponsor-bug page.
  { slug: 'com-patrocinador', query: '' },
  // No sponsor this morning: the mark and the word alone.
  { slug: 'sem-patrocinador', query: '&sponsor=off' },
];

test.describe('the sponsor bug looks like its baseline', () => {
  for (const variant of variants) {
    for (const stage of ['grey', 'black'] as const) {
      test(`${variant.slug} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the built preview on this stage, on air with its images.
        await openPreviewOnAirWithImagesLoaded(page, `preview.html?stage=${stage}${variant.query}`);

        // Act: measure the card.
        const cardBox = await page.getByTestId('sponsor-bug-panel').boundingBox();

        // Assert: the bug's slot, and its look against the baseline. A 1% pixel tolerance
        // absorbs anti-aliasing differences between GPU drivers without letting a colour
        // or text change through.
        expect(
          { left: cardBox?.x, right: (cardBox?.x ?? 0) + (cardBox?.width ?? 0), top: cardBox?.y },
          'the bug must sit in its slot: x 96 to 428, top at y 54',
        ).toEqual({ left: 96, right: 428, top: 54 });
        await expect(
          page,
          `the bug ${variant.slug} must look like its baseline on ${stage}`,
        ).toHaveScreenshot(`sponsor-bug-${variant.slug}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});
