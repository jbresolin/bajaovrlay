/**
 * Race clock screenshots, one per flag state (packages/graphics/race-clock, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the race clock is
 *   pinned by screenshots: one per flag state, taken from preview.html?data=… and
 *   compared against the baselines stored next to this file.
 *
 * What these tests prove:
 *   - Each of the six flag states (pre, green, yellow, red, checkered, finished) still
 *     draws exactly like its baseline: band colour, label, clock and laps.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the screenshots show the end of the play-in animation only.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter race-clock test:e2e --update-snapshots`.
 */
import { expect, test } from '@playwright/test';

import { buildPreviewAddressWithData } from './previewAddress.js';

const flagStateScenarios = [
  // Before the start: neutral band, the clock still at zero, no laps yet.
  { flagState: 'pre', referenceTimeMs: 0, lapsCompletedByLeader: undefined },
  // Racing: the everyday look.
  { flagState: 'green', referenceTimeMs: 3_900_000, lapsCompletedByLeader: 12 },
  // Caution: yellow band with dark text, which must stay readable.
  { flagState: 'yellow', referenceTimeMs: 5_025_000, lapsCompletedByLeader: 17 },
  // Session stopped: red band, clock held.
  { flagState: 'red', referenceTimeMs: 6_070_000, lapsCompletedByLeader: 20 },
  // End of race: the checkered pattern, with a label that must stay readable over it.
  { flagState: 'checkered', referenceTimeMs: 14_400_000, lapsCompletedByLeader: 48 },
  // After the race: neutral dark band with the final time.
  { flagState: 'finished', referenceTimeMs: 14_400_000, lapsCompletedByLeader: 48 },
];

test.describe('the race clock looks like its baseline', () => {
  for (const { flagState, referenceTimeMs, lapsCompletedByLeader } of flagStateScenarios) {
    test(`under the ${flagState} flag state`, async ({ page }) => {
      // Arrange: a held clock (running = false), so the time cannot move between runs.
      const heldClockData = {
        sessionName: 'Enduro de Resistência',
        state: flagState,
        clockMode: 'elapsed',
        referenceTimeMs,
        referenceWallClockMs: Date.parse('2026-05-16T14:30:00.000Z'),
        running: false,
        lapsCompletedByLeader,
      };

      // Act: open the preview, wait for the play-in to finish and the font to be ready.
      await page.goto(buildPreviewAddressWithData(heldClockData));
      await expect(page.locator('body'), 'the clock must be on air').toHaveAttribute(
        'data-preview-state',
        'onAir',
      );
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      // Assert: the graphic matches its baseline. A 1% pixel tolerance absorbs
      // anti-aliasing differences between GPU drivers without letting a colour or
      // text change through.
      await expect(
        page.getByTestId('race-clock-panel'),
        `the ${flagState} race clock must look exactly like its baseline`,
      ).toHaveScreenshot(`race-clock-${flagState}.png`, { maxDiffPixelRatio: 0.01 });
    });
  }
});
