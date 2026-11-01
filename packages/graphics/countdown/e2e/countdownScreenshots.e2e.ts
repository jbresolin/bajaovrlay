/**
 * Countdown screenshots, the card and the waiting board, on two stages
 * (packages/graphics/countdown, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the countdown's look in Ardósia is
 *   pinned by screenshots of the built preview.html at 1920x1080, on the design's grey and
 *   black stages, against the baselines beside this file. The designs they must match are
 *   docs/design/directions/ardosia/countdown.html and countdown-tela-cheia.html
 *   (screenshots/countdown.grey.jpg, .black.jpg and countdown-tela-cheia.*), with the
 *   design's moment: 23:45 before the enduro's 10:00 start.
 *
 * What these tests prove:
 *   - The card and the waiting board draw like their baselines, on both stages.
 *   - The card sits in the clock's slot (x 1404 to 1824, top at y 54); the board is
 *     --board-width (1280 px) wide and centred.
 *
 * What these tests deliberately do not cover:
 *   - Motion and the count moving; countdownLifecycle.e2e.ts. A session name or event too
 *     long for its box is held at its start (BAJAOVRLAY-55), so no scroll lands in a shot.
 *   - Other operating systems: baselines are rendered on Linux. After a deliberate visual
 *     change, refresh them with `pnpm --filter @bajaovrlay/countdown test:e2e --update-snapshots`.
 */
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** 09:36:15 on Sunday 30 March 2025 in Brasília: the design's 23:45 before the start. */
const designsMomentMs = Date.parse('2025-03-30T09:36:15.000-03:00');

/** The preview's address for a stage and a layout, with the design's sample starting at 10:00. */
function buildAddressOfTheDesignsSample(stage: string, layout: 'card' | 'fullscreen'): string {
  const designsSample = {
    layout,
    sessionName: 'Enduro de Resistência',
    startsAtMs: Date.parse('2025-03-30T10:00:00.000-03:00'),
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
  };
  return `preview.html?stage=${stage}&data=${encodeURIComponent(JSON.stringify(designsSample))}`;
}

/**
 * Opens the preview on air at the design's moment, the face loaded, its own buttons hidden.
 * The page's clock starts ten seconds before the moment and runs (GSAP reads it, so a frozen
 * clock would never end the play-in); once on air it is paused half a second after the
 * moment, so the count rests at 23:45 for the shot.
 */
async function openPreviewOnAirAtTheDesignsMoment(page: Page, address: string): Promise<void> {
  await page.clock.install({ time: designsMomentMs - 10_000 });
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensHoldingAtTheStart);
  await page.goto(address);
  await expect(page.locator('body'), 'the countdown must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.clock.pauseAt(designsMomentMs + 500);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

test.describe('the countdown looks like its baseline', () => {
  for (const stage of ['grey', 'black'] as const) {
    test(`the card on the ${stage} stage`, async ({ page }) => {
      // Arrange: the card on air.
      await openPreviewOnAirAtTheDesignsMoment(page, buildAddressOfTheDesignsSample(stage, 'card'));

      // Act: measure the card.
      const cardBox = await page.getByTestId('countdown-panel').boundingBox();

      // Assert: the clock's slot, the count, and the look. A 1% pixel tolerance absorbs
      // anti-aliasing differences between GPU drivers without letting a colour through.
      expect(
        { left: cardBox?.x, right: (cardBox?.x ?? 0) + (cardBox?.width ?? 0), top: cardBox?.y },
        'the card sits in the clock’s slot',
      ).toEqual({ left: 1404, right: 1824, top: 54 });
      await expect(page.getByTestId('countdown-count'), 'the design’s count').toHaveText('23:45');
      await expect(page, `the card must look like its baseline on ${stage}`).toHaveScreenshot(
        `countdown-card-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });

    test(`the waiting board on the ${stage} stage`, async ({ page }) => {
      // Arrange: the waiting board on air.
      await openPreviewOnAirAtTheDesignsMoment(
        page,
        buildAddressOfTheDesignsSample(stage, 'fullscreen'),
      );

      // Act: measure the board.
      const boardBox = await page.getByTestId('countdown-panel').boundingBox();

      // Assert: 1280 wide and centred, and the look.
      expect({ left: boardBox?.x, width: boardBox?.width }, 'the narrow board, centred').toEqual({
        left: 320,
        width: 1280,
      });
      await expect(page.getByTestId('countdown-count'), 'the design’s count').toHaveText('23:45');
      await expect(page, `the board must look like its baseline on ${stage}`).toHaveScreenshot(
        `countdown-tela-cheia-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  }
});
