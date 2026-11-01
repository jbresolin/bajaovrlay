/**
 * Battle card: names too long for a car's pill stay inside the safe area
 * (packages/graphics/battle-card, Playwright)
 *
 * What this module is for:
 *   The card sits bottom-centre: two car pills and the gap card between them, each pill as
 *   wide as what it holds. Before BAJAOVRLAY-55 two long names pushed both pills off the
 *   title-safe area; now each car's team column stops at `--battle-team-max-width` and the
 *   name and the school scroll inside their lines.
 *
 * What these tests prove, with "Instituto Federal de Educação, Ciência e Tecnologia
 * Fluminense - IFF - Campus Itaperuna" and "Universidade Tecnológica Federal do Paraná -
 * Cornélio Procópio" as the two cars' schools and team names:
 *   - Each car's name and school boxes stop at 460 px, and the whole card stays inside the
 *     title-safe area (x 96 to 1824).
 *   - At the end of the scroll the end of the longest line shows inside its box, the box
 *     as wide as at rest.
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing: the theme's tokens are overridden so the text reaches its end at
 *     once; the kit's unit tests cover the timing.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import {
  expectTextEndShowing,
  longestBajaSchoolNames,
  measureScrollingBox,
  textTokensScrollingToTheEndAtOnce,
  waitForScrollPhase,
} from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, test } from '@playwright/test';

/** `--battle-team-max-width` in Ardósia: 460 px keeps two cars and the gap card inside 1728 px. */
const battleTeamMaxWidthPx = 460;

/** The title-safe area's left and right edges on the 1920 px stage. */
const safeAreaLeftPx = 96;
const safeAreaRightPx = 1824;

/** A battle for 4th between the two cars with the longest names of the field. */
const battleOfTheLongestNames = {
  aheadPosition: 4,
  aheadCarNumber: 47,
  aheadTeamName: longestBajaSchoolNames.iffItaperuna,
  aheadSchoolName: longestBajaSchoolNames.iffItaperuna,
  aheadLaps: 12,
  behindPosition: 5,
  behindCarNumber: 14,
  behindTeamName: longestBajaSchoolNames.utfprCornelioProcopio,
  behindSchoolName: longestBajaSchoolNames.utfprCornelioProcopio,
  behindLaps: 12,
  gapMs: 2000,
};

test.describe('a battle between two cars with long names', () => {
  test('keeps every name box at its maximum and the card inside the safe area', async ({
    page,
  }) => {
    // Arrange: the battle on air, every long text scrolled to its end at once.
    await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensScrollingToTheEndAtOnce);
    await page.goto(buildPreviewAddressWithData(battleOfTheLongestNames));
    await expect(page.locator('body'), 'the battle card must be on air').toHaveAttribute(
      'data-preview-state',
      'onAir',
    );
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const aheadName = page.getByTestId('battle-card-ahead-team-name');
    const restingWidth = (await measureScrollingBox(aheadName)).boxWidth;

    // Act: wait for the end of the scroll and measure every box and the card.
    await waitForScrollPhase(aheadName, 'holdingAtEnd');
    const boxTestIds = [
      'battle-card-ahead-team-name',
      'battle-card-ahead-school-name',
      'battle-card-behind-team-name',
      'battle-card-behind-school-name',
    ];
    const boxWidths = await Promise.all(
      boxTestIds.map(
        async (testId) => (await measureScrollingBox(page.getByTestId(testId))).boxWidth,
      ),
    );
    const card = await page.getByTestId('battle-card').boundingBox();
    const aheadPlace = await measureScrollingBox(aheadName);

    // Assert: no box past its maximum, the card inside the safe area, the end showing.
    for (const boxWidth of boxWidths) {
      expect(boxWidth, 'no name box may pass --battle-team-max-width').toBeLessThanOrEqual(
        battleTeamMaxWidthPx,
      );
    }
    expect(card?.x, 'the card must start inside the safe area').toBeGreaterThanOrEqual(
      safeAreaLeftPx,
    );
    expect(
      (card?.x ?? 0) + (card?.width ?? 0),
      'the card must end inside the safe area',
    ).toBeLessThanOrEqual(safeAreaRightPx);
    expect(aheadPlace.boxWidth, 'the scroll must not change the box width').toBeCloseTo(
      restingWidth,
      1,
    );
    expectTextEndShowing(aheadPlace);
  });
});
