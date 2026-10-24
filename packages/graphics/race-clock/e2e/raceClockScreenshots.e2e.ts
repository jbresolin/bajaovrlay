/**
 * Race clock screenshots, one per flag state and one without the band
 * (packages/graphics/race-clock, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the race clock in
 *   Ardósia is pinned by screenshots: one per flag state and one with the band switched
 *   off, taken from preview.html?data=… (which loads the theme's tokens and font the way
 *   the renderer page does) and compared against the baselines stored next to this file.
 *   The design they must match is docs/design/directions/ardosia/race-clock.html and
 *   sheet-flags.html (PR #19).
 *
 * What these tests prove:
 *   - Each of the six flag states (pre, green, yellow, red, checkered, finished) still
 *     draws exactly like its baseline: the head with the logo and the title, the caption
 *     line with the leader laps, the time, and the band's colour and word (the checkered
 *     band has no word, only the pattern).
 *   - With the band switched off (showFlagBand false) the card is head and body only,
 *     40 px lower, exactly like its baseline.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the screenshots show the end of the play-in animation only.
 *   - The stage behind the card: the preview's stand-in is a gradient, not the footage
 *     of the design pages; the card itself is what is compared.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/race-clock test:e2e --update-snapshots`.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import { expect, type Page, test } from '@playwright/test';

const flagStateScenarios = [
  // Before the start: neutral band, the clock still at zero, no laps yet.
  { flagState: 'pre', referenceTimeMs: 0, lapsCompletedByLeader: undefined },
  // Racing: the everyday look.
  { flagState: 'green', referenceTimeMs: 3_900_000, lapsCompletedByLeader: 12 },
  // Caution: yellow band with dark text, which must stay readable.
  { flagState: 'yellow', referenceTimeMs: 5_025_000, lapsCompletedByLeader: 17 },
  // Session stopped: red band, clock held.
  { flagState: 'red', referenceTimeMs: 6_070_000, lapsCompletedByLeader: 20 },
  // End of race: the checkered pattern alone, with no word over it.
  { flagState: 'checkered', referenceTimeMs: 14_400_000, lapsCompletedByLeader: 48 },
  // After the race: neutral dark band with the final time.
  { flagState: 'finished', referenceTimeMs: 14_400_000, lapsCompletedByLeader: 48 },
];

/**
 * Opens the preview with a held clock (running = false, so the time cannot move between
 * runs), waits for the play-in to finish and for the theme's font to be ready.
 */
async function openPreviewWithHeldClock(
  page: Page,
  heldClockData: Record<string, unknown>,
): Promise<void> {
  await page.goto(buildPreviewAddressWithData(heldClockData));
  await expect(page.locator('body'), 'the clock must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('the race clock looks like its baseline', () => {
  for (const { flagState, referenceTimeMs, lapsCompletedByLeader } of flagStateScenarios) {
    test(`under the ${flagState} flag state`, async ({ page }) => {
      // Arrange: a held enduro clock under this flag state, with its band.
      const heldClockData = {
        sessionName: 'Enduro de Resistência',
        state: flagState,
        clockMode: 'elapsed',
        referenceTimeMs,
        referenceWallClockMs: Date.parse('2026-05-16T14:30:00.000Z'),
        running: false,
        lapsCompletedByLeader,
      };

      // Act: open the preview on air with it.
      await openPreviewWithHeldClock(page, heldClockData);

      // Assert: the card matches its baseline. A 1% pixel tolerance absorbs
      // anti-aliasing differences between GPU drivers without letting a colour or
      // text change through.
      await expect(
        page.getByTestId('race-clock-panel'),
        `the ${flagState} race clock must look exactly like its baseline`,
      ).toHaveScreenshot(`race-clock-${flagState}.png`, { maxDiffPixelRatio: 0.01 });
    });
  }

  test('without the flag band', async ({ page }) => {
    // Arrange: the green-flag enduro with the band switched off: head and body only.
    const heldClockWithoutBand = {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 3_900_000,
      referenceWallClockMs: Date.parse('2026-05-16T14:30:00.000Z'),
      running: false,
      lapsCompletedByLeader: 12,
      showFlagBand: false,
    };

    // Act: open the preview on air with it.
    await openPreviewWithHeldClock(page, heldClockWithoutBand);

    // Assert: the lower card matches its baseline, and it really is the band's 40 px
    // lower than the card with the band (192 px in Ardósia).
    const cardPlace = await page.getByTestId('race-clock-panel').boundingBox();
    expect(cardPlace?.height, 'without the band the card must be 152 px tall').toBe(152);
    await expect(
      page.getByTestId('race-clock-panel'),
      'the race clock without its band must look exactly like its baseline',
    ).toHaveScreenshot('race-clock-sem-faixa.png', { maxDiffPixelRatio: 0.01 });
  });
});
