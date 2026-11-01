/**
 * Lower third: a name too long for its pill scrolls inside it
 * (packages/graphics/lower-third, Playwright)
 *
 * What this module is for:
 *   A pill is as wide as what it holds, but never wider than `--lower-third-max-width`
 *   (1300 px: the title-safe width left of the tower's column). Before BAJAOVRLAY-55 a long
 *   name pushed the pill off the safe area; now the pill stops at its maximum and the name
 *   scrolls inside it. This is the real thing in Chromium, measured, at OBS's size.
 *
 * What these tests prove:
 *   - "Instituto Federal de Educação, Ciência e Tecnologia Fluminense - IFF - Campus
 *     Itaperuna" as the name: the pill stops at 1300 px, left of the tower's column and
 *     inside the safe area; at rest the name's start shows; at the end of the scroll its
 *     end shows, the pill and the name's box keeping their width.
 *   - "Universidade Tecnológica Federal do Paraná - Cornélio Procópio" fits: the pill is as
 *     wide as the name, under the maximum, and the name never moves.
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing: the theme's tokens are overridden so the text rests for ten
 *     minutes, or reaches its end at once; the kit's unit tests cover the timing.
 *   - The role pill's texts scrolling; lower-third.scrollingText.test.ts makes them
 *     scrolling boxes, and the kit's tests drive the cycle.
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

/** Opens the lower third on air with this name, the given text tokens in force. */
async function openLowerThirdWithName(
  page: Page,
  name: string,
  textTokens: Record<string, string>,
): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokens);
  await page.goto(buildPreviewAddressWithData({ name, role: 'Representante da instituição' }));
  await expect(page.locator('body'), 'the lower third must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The name pill's left and right edges and width on the stage. */
async function measureNamePill(page: Page) {
  const box = await page.getByTestId('lower-third-name-pill').boundingBox();
  if (box === null) {
    throw new Error('the name pill is not on the stage');
  }
  return { left: box.x, right: box.x + box.width, width: box.width };
}

test.describe('a name too long for the name pill', () => {
  test('stops the pill at its maximum and shows the name’s start at rest', async ({ page }) => {
    // Arrange: the IFF's full name on air, held at its start.
    await openLowerThirdWithName(
      page,
      longestBajaSchoolNames.iffItaperuna,
      textTokensHoldingAtTheStart,
    );
    const nameBox = page.getByTestId('lower-third-name');
    await waitForScrollPhase(nameBox, 'holdingAtStart');

    // Act: measure the pill and the name's box.
    const pill = await measureNamePill(page);
    const namePlace = await measureScrollingBox(nameBox);

    // Assert: the pill at its maximum, left of the tower, the name's start showing.
    expect(pill.width, 'the pill must stop at --lower-third-max-width').toBeCloseTo(
      lowerThirdMaxWidthPx,
      0,
    );
    expect(pill.right, 'the pill must end left of the tower’s column').toBeLessThan(
      towerColumnLeftPx,
    );
    expectTextStartShowing(namePlace);
  });

  test('shows the name’s end at the end of the scroll, the pill as wide', async ({ page }) => {
    // Arrange: the IFF's full name on air, scrolled to its end at once.
    await openLowerThirdWithName(
      page,
      longestBajaSchoolNames.iffItaperuna,
      textTokensScrollingToTheEndAtOnce,
    );
    const nameBox = page.getByTestId('lower-third-name');

    // Act: wait for the end of the scroll and measure.
    await waitForScrollPhase(nameBox, 'holdingAtEnd');
    const pill = await measureNamePill(page);
    const namePlace = await measureScrollingBox(nameBox);

    // Assert: still at its maximum, the end of the name inside the box.
    expect(pill.width, 'the scroll must not change the pill width').toBeCloseTo(
      lowerThirdMaxWidthPx,
      0,
    );
    expectTextEndShowing(namePlace);
  });
});

test.describe('a long name that fits the name pill', () => {
  test('makes the pill as wide as the name, under the maximum, and never moves', async ({
    page,
  }) => {
    // Arrange: the UTFPR's full name, about 1000 px at the name's size.
    await openLowerThirdWithName(
      page,
      longestBajaSchoolNames.utfprCornelioProcopio,
      textTokensScrollingToTheEndAtOnce,
    );
    const nameBox = page.getByTestId('lower-third-name');

    // Act: measure the pill and the name.
    const pill = await measureNamePill(page);
    const namePlace = await measureScrollingBox(nameBox);

    // Assert: under the maximum, the whole name inside its box, no phase at all.
    expect(pill.width, 'the pill must be narrower than its maximum').toBeLessThan(
      lowerThirdMaxWidthPx,
    );
    expect(namePlace.textRight, 'the whole name must fit').toBeLessThanOrEqual(
      namePlace.boxRight + 0.5,
    );
    expect(Math.abs(namePlace.textLeft - namePlace.boxLeft), 'the name must not move').toBeLessThan(
      1,
    );
    await expect(nameBox, 'a fitting name must join no cycle').not.toHaveAttribute(
      'data-scroll-phase',
    );
  });
});
