/**
 * Lower strip screenshots, page 1 with and without the clock block, without the flag and
 * with the laps and gaps, on two stages (packages/graphics/lower-strip, Playwright)
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
 *   - The looks of BAJAOVRLAY-81 draw like theirs: no flag (the block closes up around the
 *     time), each car with its laps (four cars, "1/9"), with its laps and gap in laps (three
 *     cars, "1/12"), and the gap in laps and time early in the race ("+3,2" on the leader's
 *     lap, "+1 VOLTA" lapped).
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

/**
 * Four cars early in the enduro, as the positions send them with gaps worked out: two on
 * the leader's lap (a gap in ms), one lapped (a gap in laps). Real schools of the field.
 */
const earlyInTheRaceEntries = [
  { position: 1, carNumber: 51, schoolName: 'FAHOR', laps: 5 },
  { position: 2, carNumber: 10, schoolName: 'UFSJ', laps: 5, gapToLeaderMs: 3_250 },
  { position: 3, carNumber: 47, schoolName: 'UTFPR-PB', laps: 5, gapToLeaderMs: 12_399 },
  { position: 4, carNumber: 1, schoolName: 'FEI', laps: 4, gapToLeaderLaps: 1 },
];

/** The four cars above with the clock held at 1:00:00 under green, gap in laps and time. */
const earlyInTheRaceData = {
  entries: earlyInTheRaceEntries,
  state: 'green',
  clockMode: 'elapsed',
  referenceTimeMs: 3_600_000,
  referenceWallClockMs: 0,
  running: false,
  gapDisplay: 'lapsAndTime',
};

const variants = [
  // The design's lower-strip page.
  { slug: 'com-relogio', query: '', pageCell: '1/6' },
  // The race clock card is up, so the strip leaves out its block.
  { slug: 'sem-relogio', query: '&clock=off', pageCell: '1/6' },
  // BAJAOVRLAY-81: "Bandeira" cleared, the block closes up around the time.
  { slug: 'sem-bandeira', query: '&flag=off', pageCell: '1/6' },
  // BAJAOVRLAY-81: each car with its laps, four a page.
  { slug: 'com-voltas', query: '&laps=on', pageCell: '1/9' },
  // BAJAOVRLAY-81: laps and the gap in laps, three a page, the leader without a gap.
  { slug: 'com-voltas-e-diferenca', query: '&laps=on&gap=laps', pageCell: '1/12' },
  // BAJAOVRLAY-81: the gap in laps and time, early in the race, so both forms show.
  {
    slug: 'diferenca-voltas-e-tempo',
    query: `&data=${encodeURIComponent(JSON.stringify(earlyInTheRaceData))}`,
    pageCell: '1/1',
  },
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
          variant.pageCell,
        );
        await expect(
          page,
          `the strip ${variant.slug} must look like its baseline on ${stage}`,
        ).toHaveScreenshot(`lower-strip-${variant.slug}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});
