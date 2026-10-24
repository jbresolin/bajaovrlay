/**
 * Notice screenshots, one per variant (packages/graphics/notice, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the notice in Ardósia
 *   is pinned by screenshots: the fastest lap and the penalty, taken from
 *   preview.html?data=… (which loads the theme's tokens and font the way the renderer
 *   page does) at 1920x1080 and compared against the baselines stored next to this file.
 *   The design they must match is docs/design/directions/ardosia/fastest-lap.html and
 *   penalty-notice.html (PR #21), with the same data.
 *
 * What these tests prove:
 *   - The fastest lap still draws exactly like its baseline: the green MELHOR VOLTA badge
 *     and VOLTA 34 in the head, then chip 31, ACAUÃ BAJA with MAUÁ and 4:38,2 in green.
 *   - The penalty still draws exactly like its baseline: the triangle, PENALIDADE and
 *     DIREÇÃO DE PROVA in the head, chip 47, CARNAÚBA BAJA with UFERSA, then QUEIMA DE
 *     LARGADA and the navy +30 SEGUNDOS cell.
 *   - Both cards sit where the design puts them: under the bug at x 96, y 186, 420 wide.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the screenshots show the end of the play-in only (noticeLifecycle.e2e.ts
 *     covers in and out).
 *   - The stage behind the card: the preview's stand-in is a gradient, not the footage of
 *     the design pages; the whole stage is captured so the card's place is pinned too.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/notice test:e2e --update-snapshots`.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress';
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview with the data, waits for the play-in to finish and for the font. */
async function openPreviewOnAir(page: Page, noticeData: Record<string, unknown>): Promise<void> {
  await page.goto(buildPreviewAddressWithData(noticeData));
  await expect(page.locator('body'), 'the notice must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

const variantScenarios = [
  {
    // The design's fastest lap (fastest-lap.html).
    variant: 'fastestLap',
    noticeData: {
      variant: 'fastestLap',
      carNumber: 31,
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      lapNumber: 34,
      lapTimeText: '4:38,2',
    },
    screenshotName: 'notice-fastest-lap.png',
  },
  {
    // The design's penalty (penalty-notice.html).
    variant: 'penalty',
    noticeData: {
      variant: 'penalty',
      carNumber: 47,
      teamName: 'Carnaúba Baja',
      schoolName: 'UFERSA',
      noticeKind: 'penalty',
      reason: 'Queima de largada',
      penaltyText: '+30 segundos',
    },
    screenshotName: 'notice-penalty.png',
  },
];

test.describe('the notice looks like its baseline', () => {
  for (const { variant, noticeData, screenshotName } of variantScenarios) {
    test(`as a ${variant}`, async ({ page }) => {
      // Arrange: the design's data for this variant comes from the scenario row above.

      // Act: open the preview on air with it, and hide the preview's own buttons, which
      // are not on air, so only the stage is captured.
      await openPreviewOnAir(page, noticeData);
      await page.locator('#preview-controls').evaluate((controls) => {
        controls.style.visibility = 'hidden';
      });

      // Assert: the card is under the bug, 420 wide, and the stage matches its baseline.
      // A 1% pixel tolerance absorbs anti-aliasing differences between GPU drivers
      // without letting a colour or text change through.
      const cardPlace = await page.getByTestId('notice-panel').boundingBox();
      expect(
        { x: cardPlace?.x, y: cardPlace?.y, width: cardPlace?.width },
        'the card must sit under the bug at x 96, y 186, 420 wide',
      ).toEqual({ x: 96, y: 186, width: 420 });
      await expect(
        page,
        `the ${variant} notice must look exactly like its baseline`,
      ).toHaveScreenshot(screenshotName, { maxDiffPixelRatio: 0.01 });
    });
  }
});
