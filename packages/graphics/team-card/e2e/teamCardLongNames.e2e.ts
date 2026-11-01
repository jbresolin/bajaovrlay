/**
 * Team card: a name too long for the card scrolls inside it
 * (packages/graphics/team-card, Playwright)
 *
 * What this module is for:
 *   The card is as wide as what it holds, but never wider than `--lower-third-max-width`
 *   (1300 px: the title-safe width left of the tower's column). Before BAJAOVRLAY-55 a long
 *   name pushed the card off the safe area; now the card stops at its maximum and the name
 *   scrolls inside its box. This is the real thing in Chromium, measured, at OBS's size.
 *
 * What these tests prove:
 *   - "Instituto Federal de Educação, Ciência e Tecnologia Fluminense - IFF - Campus
 *     Itaperuna" as the team's name: the card stops at 1300 px, left of the tower's column;
 *     at rest the name's start shows; at the end of the scroll its end shows, the card and
 *     the name's box keeping their width.
 *   - "Universidade Tecnológica Federal do Paraná - Cornélio Procópio" as the school, with
 *     its place line, fits: the card is under its maximum and the details never move.
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing: the theme's tokens are overridden so the text rests for ten
 *     minutes, or reaches its end at once; the kit's unit tests cover the timing.
 *   - The photo and the logo: the cards here have neither, which leaves the most room to
 *     the text; teamCardScreenshots.e2e.ts covers the combinations.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import {
  expectTextEndShowing,
  expectTextStartShowing,
  longestBajaSchoolNames,
  measureScrollingBox,
  textTokensHoldingAtTheStart,
  textTokensScrollingToTheEndAtOnce,
  waitForScrollPhase,
} from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** `--lower-third-max-width` in Ardósia: 1728 − 420 − 8. */
const lowerThirdMaxWidthPx = 1300;

/** Where the tower's column begins on the stage: 1920 − 96 − 420. */
const towerColumnLeftPx = 1404;

/** Car 47 with the IFF's full name as the team's name. */
const carWithTheLongestTeamName = {
  carNumber: 47,
  teamName: longestBajaSchoolNames.iffItaperuna,
  schoolName: 'IFF',
  city: 'Itaperuna',
  state: 'RJ',
};

/** Car 14 with the UTFPR's full name as the school, and its city. */
const carWithTheLongestSchool = {
  carNumber: 14,
  teamName: 'Baja UTFPR',
  schoolName: longestBajaSchoolNames.utfprCornelioProcopio,
  city: 'Cornélio Procópio',
  state: 'PR',
};

/** Opens the team card on air with this car, the given text tokens in force. */
async function openTeamCard(
  page: Page,
  data: Record<string, unknown>,
  textTokens: Record<string, string>,
): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokens);
  await page.goto(buildPreviewAddressWithData(data));
  await expect(page.locator('body'), 'the team card must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The card's right edge and width on the stage. */
async function measureCard(page: Page) {
  const box = await page.getByTestId('team-card-panel').boundingBox();
  if (box === null) {
    throw new Error('the team card is not on the stage');
  }
  return { right: box.x + box.width, width: box.width };
}

test.describe('a team name too long for the card', () => {
  test('stops the card at its maximum and shows the name’s start at rest', async ({ page }) => {
    // Arrange: car 47 on air, its name held at its start.
    await openTeamCard(page, carWithTheLongestTeamName, textTokensHoldingAtTheStart);
    const nameBox = page.getByTestId('team-card-team-name');
    await waitForScrollPhase(nameBox, 'holdingAtStart');

    // Act: measure the card and the name's box.
    const card = await measureCard(page);
    const namePlace = await measureScrollingBox(nameBox);

    // Assert: the card at its maximum, left of the tower, the name's start showing.
    expect(card.width, 'the card must stop at --lower-third-max-width').toBeCloseTo(
      lowerThirdMaxWidthPx,
      0,
    );
    expect(card.right, 'the card must end left of the tower’s column').toBeLessThan(
      towerColumnLeftPx,
    );
    expectTextStartShowing(namePlace);
  });

  test('shows the name’s end at the end of the scroll, the card as wide', async ({ page }) => {
    // Arrange: car 47 on air, its name scrolled to its end at once.
    await openTeamCard(page, carWithTheLongestTeamName, textTokensScrollingToTheEndAtOnce);
    const nameBox = page.getByTestId('team-card-team-name');
    const nameBoxAtTheStart = await measureScrollingBox(nameBox);

    // Act: wait for the end of the scroll and measure.
    await waitForScrollPhase(nameBox, 'holdingAtEnd');
    const card = await measureCard(page);
    const namePlace = await measureScrollingBox(nameBox);

    // Assert: the card and the name's box as wide, the end of the name inside the box.
    expect(card.width, 'the scroll must not change the card width').toBeCloseTo(
      lowerThirdMaxWidthPx,
      0,
    );
    expect(namePlace.boxWidth, 'the scroll must not change the name box width').toBeCloseTo(
      nameBoxAtTheStart.boxWidth,
      1,
    );
    expectTextEndShowing(namePlace);
  });
});

test.describe('a long school that fits the card', () => {
  test('keeps the card under its maximum and the details still', async ({ page }) => {
    // Arrange: car 14 on air, every long text set to scroll at once.
    await openTeamCard(page, carWithTheLongestSchool, textTokensScrollingToTheEndAtOnce);
    const detailsBox = page.getByTestId('team-card-details');

    // Act: measure the card and the details.
    const card = await measureCard(page);
    const detailsPlace = await measureScrollingBox(detailsBox);

    // Assert: under the maximum, the whole line inside its box, no phase at all.
    expect(card.width, 'the card must be narrower than its maximum').toBeLessThan(
      lowerThirdMaxWidthPx,
    );
    expect(detailsPlace.textRight, 'the whole details line must fit').toBeLessThanOrEqual(
      detailsPlace.boxRight + 0.5,
    );
    await expect(detailsBox, 'a fitting line must join no cycle').not.toHaveAttribute(
      'data-scroll-phase',
    );
  });
});
