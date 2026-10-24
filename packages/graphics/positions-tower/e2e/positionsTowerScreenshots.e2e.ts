/**
 * Positions tower screenshots: compact, and detailed with three column sets
 * (packages/graphics/positions-tower, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the tower in Ardósia
 *   is pinned by screenshots taken from preview.html?data=… (which loads the theme's
 *   tokens and font the way the renderer page does) and compared against the baselines
 *   stored next to this file. The design they must match is docs/design/directions/
 *   ardosia/positions-compact.html, positions-detailed.html and sheet-columns.html (PR #19).
 *
 * What these tests prove:
 *   - Page 1 of the 60-car sample in the compact layout draws like its baseline: the
 *     head's captions, yellow positions, the leader's green chip, blue car chips, the
 *     names in caps, green laps, the pit icon on car 69.
 *   - The detailed layout with the default columns draws like its baseline: the school
 *     after the team name, the gaps without a unit ("+19,0", "+1 VOLTA"), the lap times,
 *     the pit stops, 1072 px wide.
 *   - The detailed layout with every column (the refuels on) and with the four time
 *     columns off each draw like their baselines, the tower as wide as what it shows.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the screenshots show the end of the play-in animation only. The pages are
 *     held on page 1 (paging firstPageOnly) so no page turn can land during a capture.
 *   - The stage behind the tower: the preview's stand-in is a gradient, not the footage
 *     of the design pages; the tower itself is what is compared.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/positions-tower test:e2e --update-snapshots`.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import { expect, type Page, test } from '@playwright/test';

import { readEnduroSampleEntries } from './sampleEntries.js';

/**
 * Opens the preview with the sample held on page 1 and the given settings, waits for
 * the play-in to finish and for the theme's font to be ready.
 */
async function openPreviewOnPageOne(page: Page, settings: Record<string, unknown>): Promise<void> {
  const towerData = { entries: readEnduroSampleEntries(), paging: 'firstPageOnly', ...settings };
  await page.goto(buildPreviewAddressWithData(towerData));
  await expect(page.locator('body'), 'the tower must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

const layoutScenarios = [
  // The scoreboard's look: position, car chip, team, laps.
  { name: 'compact', settings: { layout: 'compact' } },
  // The timing board with the design's default columns (the refuels off).
  { name: 'detailed with the default columns', settings: { layout: 'detailed' } },
  // Every column, ABAST. included.
  { name: 'detailed with every column', settings: { layout: 'detailed', showFuelStops: true } },
  // An event without lap timing: VOLTAS and PARADAS only, the tower narrower.
  {
    name: 'detailed with the time columns off',
    settings: {
      layout: 'detailed',
      showGap: false,
      showInterval: false,
      showLastLap: false,
      showBestLap: false,
    },
  },
];

test.describe('the positions tower looks like its baseline', () => {
  for (const { name, settings } of layoutScenarios) {
    test(name, async ({ page }) => {
      // Arrange and act: open the preview on air with page 1 in this layout.
      await openPreviewOnPageOne(page, settings);

      // Assert: the tower matches its baseline. A 1% pixel tolerance absorbs
      // anti-aliasing differences between GPU drivers without letting a colour or
      // text change through.
      const baselineName = `positions-tower-${name.replaceAll(' ', '-')}.png`;
      await expect(
        page.getByTestId('positions-tower'),
        `the tower (${name}) must look exactly like its baseline`,
      ).toHaveScreenshot(baselineName, { maxDiffPixelRatio: 0.01 });
    });
  }

  test('the detailed tower with the default columns is 1072 px wide', async ({ page }) => {
    // Arrange and act: the detailed tower with the design's default columns.
    await openPreviewOnPageOne(page, { layout: 'detailed' });

    // Assert: the width the design's README gives for the default set.
    const towerPlace = await page.getByTestId('positions-tower').boundingBox();
    expect(towerPlace?.width, 'the default detailed tower must be 1072 px wide').toBe(1072);
  });
});
