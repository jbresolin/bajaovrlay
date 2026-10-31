/**
 * Positions tower: names too long for the team column scroll inside it
 * (packages/graphics/positions-tower, Playwright)
 *
 * What this module is for:
 *   In the detailed layout a row's team cell holds the team name and its school. The
 *   longest schools of the Baja field are far wider than the column; instead of an
 *   ellipsis the two scroll together inside the cell (BAJAOVRLAY-55), every row on one
 *   cycle. This is the real thing in Chromium, measured, at the size OBS draws it.
 *
 * What these tests prove, with "Universidade Tecnológica Federal do Paraná - Cornélio
 * Procópio" and "Instituto Federal de Educação, Ciência e Tecnologia Fluminense - IFF -
 * Campus Itaperuna" as schools:
 *   - The team cell keeps the column's width: as wide as the row with a short school.
 *   - At rest the start of the line (the team name) shows at the cell's left edge.
 *   - At the end of the scroll the end of the school shows inside the cell, clear of the
 *     fade, the cell still as wide.
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing: the theme's tokens are overridden so the text rests for ten
 *     minutes, or reaches its end at once; the kit's unit tests cover the timing.
 *   - The frame budget; positionsTowerFrameBudget.e2e.ts.
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

/** Three cars: a short school, then the two longest schools of the field. */
function createRowsWithTheLongestSchools() {
  return [
    {
      position: 1,
      carNumber: 31,
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      laps: 34,
      status: 'running',
    },
    {
      position: 2,
      carNumber: 14,
      teamName: 'Baja UTFPR',
      schoolName: longestBajaSchoolNames.utfprCornelioProcopio,
      laps: 33,
      status: 'running',
    },
    {
      position: 3,
      carNumber: 47,
      teamName: 'Goytacá Baja',
      schoolName: longestBajaSchoolNames.iffItaperuna,
      laps: 33,
      status: 'running',
    },
  ];
}

/** Opens the detailed tower on air with the three rows, the given text tokens in force. */
async function openDetailedTowerWithLongSchools(
  page: Page,
  textTokens: Record<string, string>,
): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokens);
  const towerData = {
    entries: createRowsWithTheLongestSchools(),
    layout: 'detailed',
    paging: 'firstPageOnly',
  };
  await page.goto(buildPreviewAddressWithData(towerData));
  await expect(page.locator('body'), 'the tower must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The scrolling box in the team cell of the row at `rowIndex` (0 is the leader). */
function findTeamCellOfRow(page: Page, rowIndex: number) {
  return page.getByTestId('positions-tower-row').nth(rowIndex).getByTestId('row-team-box');
}

const longSchoolRows = [
  // The longest school in the field, at 2nd.
  { name: 'Universidade Tecnológica Federal do Paraná - Cornélio Procópio', rowIndex: 1 },
  // The longest name of all, at 3rd.
  { name: 'Instituto Federal de Educação, Ciência e Tecnologia Fluminense', rowIndex: 2 },
];

test.describe('a row whose school is too long for the team column', () => {
  for (const { name, rowIndex } of longSchoolRows) {
    test(`shows its start at rest, the cell as wide as the others (${name})`, async ({ page }) => {
      // Arrange: the tower on air, every long text held at its start.
      await openDetailedTowerWithLongSchools(page, textTokensHoldingAtTheStart);
      const longCell = findTeamCellOfRow(page, rowIndex);
      await waitForScrollPhase(longCell, 'holdingAtStart');

      // Act: measure the long row's cell and the leader's.
      const longPlace = await measureScrollingBox(longCell);
      const shortPlace = await measureScrollingBox(findTeamCellOfRow(page, 0));

      // Assert: same width as the short row's cell, the start of the line showing.
      expect(longPlace.boxWidth, 'the long row must keep the column width').toBeCloseTo(
        shortPlace.boxWidth,
        1,
      );
      expectTextStartShowing(longPlace);
    });

    test(`shows its end at the end of the scroll, the cell as wide (${name})`, async ({ page }) => {
      // Arrange: the tower on air, every long text scrolled to its end at once.
      await openDetailedTowerWithLongSchools(page, textTokensScrollingToTheEndAtOnce);
      const longCell = findTeamCellOfRow(page, rowIndex);
      const shortPlace = await measureScrollingBox(findTeamCellOfRow(page, 0));

      // Act: wait for the end of the scroll and measure.
      await waitForScrollPhase(longCell, 'holdingAtEnd');
      const longPlace = await measureScrollingBox(longCell);

      // Assert: still the column's width, the end of the school inside the cell.
      expect(longPlace.boxWidth, 'the scroll must not change the cell width').toBeCloseTo(
        shortPlace.boxWidth,
        1,
      );
      expectTextEndShowing(longPlace);
    });
  }

  test('leaves the short row still: it fits, so it never joins the cycle', async ({ page }) => {
    // Arrange: the tower on air, the long texts scrolled to their end at once.
    await openDetailedTowerWithLongSchools(page, textTokensScrollingToTheEndAtOnce);

    // Act: wait for a long row to reach its end.
    await waitForScrollPhase(findTeamCellOfRow(page, 1), 'holdingAtEnd');

    // Assert: the leader's cell names no phase and its text has not moved.
    const leaderCell = findTeamCellOfRow(page, 0);
    await expect(leaderCell, 'a fitting row must name no phase').not.toHaveAttribute(
      'data-scroll-phase',
    );
    const leaderPlace = await measureScrollingBox(leaderCell);
    expect(
      Math.abs(leaderPlace.textLeft - leaderPlace.boxLeft),
      'the fitting text must stay at its start',
    ).toBeLessThan(1);
  });
});
