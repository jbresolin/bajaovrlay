/**
 * Lower third screenshots on the design's grey and black stages
 * (packages/graphics/lower-third, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the lower third in
 *   Ardósia is pinned by screenshots taken from preview.html?data=…&stage=… (which loads
 *   the theme's tokens and font the way the renderer page does) at 1920x1080 and compared
 *   against the baselines stored next to this file. The design they must match is
 *   docs/design/directions/ardosia/lower-third.html, whose own screenshots are
 *   screenshots/lower-third.grey.jpg and .black.jpg, on the same two plain stages.
 *
 * What these tests prove, on the grey and on the black stage:
 *   - With role and team line (the design's own data, without its car chip): MARIANA
 *     COSTA in the 64 px name pill, then CAPITÃ DA EQUIPE · BAJA UFMG · UFMG in the 40 px
 *     role pill, the team line muted.
 *   - With role (a narrator from Cadastros): ANA PAULA RIBEIRO, then NARRADORA alone.
 *   - Without role (a name only): the name pill alone.
 *   - Where the pills sit: at x 96, the lower one's bottom at y 940; without the role
 *     pill the name pill moves down to end at y 940 itself, so a missing part takes no
 *     room and leaves no empty frame.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the screenshots show the end of the play-in only (lowerThirdLifecycle.e2e.ts
 *     covers in and out).
 *   - The footage stand-in, the preview's default stage; the design's comparison
 *     screenshots are grey and black, so those are the two pinned here.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/lower-third test:e2e --update-snapshots`.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview on the stage with the data, waits for the play-in and for the font. */
async function openPreviewOnAir(
  page: Page,
  lowerThirdData: Record<string, unknown>,
  stage: string,
): Promise<void> {
  // A text too long for its pill is held at its start (BAJAOVRLAY-55), so no scroll can
  // land during a capture.
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensHoldingAtTheStart);
  await page.goto(`${buildPreviewAddressWithData(lowerThirdData)}&stage=${stage}`);
  await expect(page.locator('body'), 'the lower third must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Reads where a pill sits on the stage: its left edge and its top and bottom edges. */
async function readPillPlace(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  if (box === null) {
    return undefined;
  }
  return { left: box.x, top: box.y, bottom: box.y + box.height };
}

const layoutScenarios = [
  {
    // The design's own lower third (lower-third.html), less the car chip this graphic
    // has no field for.
    layout: 'with role and team line',
    lowerThirdData: {
      name: 'Mariana Costa',
      role: 'Capitã da equipe',
      teamLine: 'Baja UFMG · UFMG',
    },
    screenshotName: 'lower-third-with-role-and-team-line',
    expectedNamePill: { left: 96, top: 833, bottom: 897 },
    expectedRolePill: { left: 96, top: 900, bottom: 940 },
  },
  {
    // The typical item: a person from Cadastros with a role and no team.
    layout: 'with role',
    lowerThirdData: { name: 'Ana Paula Ribeiro', role: 'Narradora' },
    screenshotName: 'lower-third-with-role',
    expectedNamePill: { left: 96, top: 833, bottom: 897 },
    expectedRolePill: { left: 96, top: 900, bottom: 940 },
  },
  {
    // A name only: the role pill is gone and the name pill takes its place at the bottom.
    layout: 'without role',
    lowerThirdData: { name: 'Ana Paula Ribeiro' },
    screenshotName: 'lower-third-without-role',
    expectedNamePill: { left: 96, top: 876, bottom: 940 },
    expectedRolePill: undefined,
  },
];

const stages = ['grey', 'black'];

test.describe('the lower third looks like its baseline', () => {
  for (const stage of stages) {
    for (const scenario of layoutScenarios) {
      test(`${scenario.layout}, on the ${stage} stage`, async ({ page }) => {
        // Arrange: the data for this layout comes from the scenario row above.

        // Act: open the preview on air on this stage, and hide the preview's own buttons,
        // which are not on air, so only the stage is captured.
        await openPreviewOnAir(page, scenario.lowerThirdData, stage);
        await page.locator('#preview-controls').evaluate((controls) => {
          controls.style.visibility = 'hidden';
        });

        // Assert: the pills sit where the design puts them (a hidden pill has no box),
        // and the stage matches its baseline. A 1% pixel tolerance absorbs anti-aliasing
        // differences between GPU drivers without letting a colour or text change through.
        expect(
          await readPillPlace(page, 'lower-third-name-pill'),
          'the name pill must sit at x 96, ending at y 940 when it stands alone',
        ).toEqual(scenario.expectedNamePill);
        expect(
          await readPillPlace(page, 'lower-third-role-pill'),
          'the role pill must end at y 940, or take no room at all when absent',
        ).toEqual(scenario.expectedRolePill);
        await expect(
          page,
          `the lower third ${scenario.layout} must look exactly like its baseline`,
        ).toHaveScreenshot(`${scenario.screenshotName}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});
