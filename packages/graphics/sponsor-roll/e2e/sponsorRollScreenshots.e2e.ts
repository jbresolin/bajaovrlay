/**
 * Sponsor roll screenshots, the full screen and the corner, on two stages
 * (packages/graphics/sponsor-roll, Playwright)
 *
 * What this module is for:
 *   The roll's look in Ardósia, pinned by screenshots of the built preview.html at 1920x1080
 *   on the design's grey and black stages, against the baselines beside this file. The
 *   designs they must match are docs/design/directions/ardosia/sponsor-roll.html and
 *   sponsor-roll-canto.html (screenshots/sponsor-roll.* and sponsor-roll-canto.*): page 1 of
 *   the 30ª Competição's 17, Bosch and Renault; the corner with Bosch, both with the real
 *   logos, files of this package.
 *
 * What these tests prove:
 *   - Both layouts draw like their baselines on both stages, every logo loaded first.
 *   - The board is --board-width (1280 px) wide and centred; the corner sits in the bug's
 *     slot (x 96, top at y 54); page 1 reads "PATROCÍNIO DIAMANTE" and "1/5".
 *
 * What these tests deliberately do not cover:
 *   - Motion and the turns; the lifecycle e2e and the component tests. After a deliberate
 *     visual change, refresh the baselines with `… test:e2e --update-snapshots`.
 */
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the preview on air with its logos loaded, the face ready and the page's buttons
 * hidden. The holds are made a day long, so no page turns while the shot is taken, and a
 * text too long for its box is held at its start (BAJAOVRLAY-55), so no scroll lands in it.
 */
async function openPreviewOnAirWithItsLogos(page: Page, address: string): Promise<void> {
  const oneDayMs = '86400000ms';
  await placeTokenOverridesBeforeTheGraphicLoads(page, {
    '--motion-sponsor-hold': oneDayMs,
    '--motion-sponsor-hold-diamante': oneDayMs,
    '--motion-sponsor-hold-ouro': oneDayMs,
    '--motion-sponsor-hold-prata': oneDayMs,
    '--motion-sponsor-hold-apoio': oneDayMs,
    '--motion-sponsor-hold-realizacao': oneDayMs,
    ...textTokensHoldingAtTheStart,
  });
  await page.goto(address);
  await expect(page.locator('body'), 'the roll must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => {
    const roll = document.querySelector('baja-sponsor-roll');
    const images = [...(roll?.shadowRoot?.querySelectorAll('img') ?? [])];
    return images.every((image) => image.complete && image.naturalWidth > 0);
  });
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

test.describe('the sponsor roll looks like its baseline', () => {
  for (const stage of ['grey', 'black'] as const) {
    test(`the full screen on the ${stage} stage`, async ({ page }) => {
      // Arrange: page 1 on air.
      await openPreviewOnAirWithItsLogos(page, `preview.html?stage=${stage}`);

      // Act: measure the board.
      const boardBox = await page.getByTestId('sponsor-roll-panel').boundingBox();

      // Assert: centred and 1280 wide, page 1's head, and the look.
      expect({ left: boardBox?.x, width: boardBox?.width }, 'the narrow board, centred').toEqual({
        left: 320,
        width: 1280,
      });
      await expect(page.getByTestId('sponsor-roll-subtitle'), 'Diamante').toHaveText(
        'PATROCÍNIO DIAMANTE',
      );
      await expect(page.getByTestId('sponsor-roll-aside'), 'page 1 of 5').toHaveText('1/5');
      await expect(
        page,
        `the full screen must look like its baseline on ${stage}`,
      ).toHaveScreenshot(`sponsor-roll-${stage}.png`, { maxDiffPixelRatio: 0.01 });
    });

    test(`the corner on the ${stage} stage`, async ({ page }) => {
      // Arrange: the corner on air.
      await openPreviewOnAirWithItsLogos(page, `preview.html?stage=${stage}&layout=corner`);

      // Act: measure the card.
      const cardBox = await page.getByTestId('sponsor-roll-panel').boundingBox();

      // Assert: the bug's slot, and the look.
      expect({ left: cardBox?.x, top: cardBox?.y }, 'the bug’s slot').toEqual({
        left: 96,
        top: 54,
      });
      await expect(page, `the corner must look like its baseline on ${stage}`).toHaveScreenshot(
        `sponsor-roll-canto-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  }
});
