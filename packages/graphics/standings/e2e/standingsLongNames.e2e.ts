/**
 * Standings: a team and school too long for the team column scroll inside it
 * (packages/graphics/standings, Playwright)
 *
 * What this module is for:
 *   A standings row's team cell holds the team name and its school. On the board in three
 *   columns (the total alone) the column is narrow, and the longest schools of the Baja
 *   field are far wider; instead of an ellipsis the two scroll together inside a box in the
 *   cell (BAJAOVRLAY-55), every row on one cycle. This is the real thing in Chromium,
 *   measured, at the size OBS draws it.
 *
 * What these tests prove, with "Universidade Tecnológica Federal do Paraná - Cornélio
 * Procópio" and "Instituto Federal de Educação, Ciência e Tecnologia Fluminense - IFF -
 * Campus Itaperuna" as schools of the 2nd and 3rd teams:
 *   - The team box keeps the column's width: as wide as the leader's, whose school is short.
 *   - At rest the start of the line (the team name) shows at the box's left edge.
 *   - At the end of the scroll the end of the school shows inside the box, clear of the
 *     fade, the box still as wide.
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing: the theme's tokens are overridden so the text rests for ten
 *     minutes, or reaches its end at once; the kit's unit tests cover the timing.
 *   - The head's event line, which is the kit's wide head (wideBoardHead.test.ts).
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

import { createOverallStandingsTotalOnly } from '../src/previewData.js';

/** The overall table in three columns, its 2nd and 3rd teams given the longest schools. */
function createColumnsBoardWithTheLongestSchools() {
  const standings = createOverallStandingsTotalOnly();
  const entries = standings.entries.map((entry, index) => {
    if (index === 1) {
      return { ...entry, schoolName: longestBajaSchoolNames.utfprCornelioProcopio };
    }
    if (index === 2) {
      return { ...entry, schoolName: longestBajaSchoolNames.iffItaperuna };
    }
    return entry;
  });
  return { ...standings, entries };
}

/** Opens the board on air, page 1, the given text tokens in force and the page held. */
async function openColumnsBoardWithLongSchools(
  page: Page,
  textTokens: Record<string, string>,
): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, {
    '--motion-board-hold': '600000ms',
    ...textTokens,
  });
  await page.goto(buildPreviewAddressWithData(createColumnsBoardWithTheLongestSchools()));
  await expect(page.locator('body'), 'the standings must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The team box of the team at `rowIndex` in the first column (0 is the leader). */
function findTeamBoxOfRow(page: Page, rowIndex: number) {
  return page.getByTestId('row-team-box').nth(rowIndex);
}

const longSchoolRows = [
  // The longest school in the field, 2nd.
  { name: 'Universidade Tecnológica Federal do Paraná - Cornélio Procópio', rowIndex: 1 },
  // The longest name of all, 3rd.
  { name: 'Instituto Federal de Educação, Ciência e Tecnologia Fluminense', rowIndex: 2 },
];

test.describe('a team whose school is too long for the team column', () => {
  for (const { name, rowIndex } of longSchoolRows) {
    test(`shows its start at rest, the box as wide as the others (${name})`, async ({ page }) => {
      // Arrange: the board on air, every long text held at its start.
      await openColumnsBoardWithLongSchools(page, textTokensHoldingAtTheStart);
      const longBox = findTeamBoxOfRow(page, rowIndex);
      await waitForScrollPhase(longBox, 'holdingAtStart');

      // Act: measure the long team's box and the leader's.
      const longPlace = await measureScrollingBox(longBox);
      const leaderPlace = await measureScrollingBox(findTeamBoxOfRow(page, 0));

      // Assert: as wide as the leader's box, the start of the line showing.
      expect(longPlace.boxWidth, 'the long team must keep the column width').toBeCloseTo(
        leaderPlace.boxWidth,
        1,
      );
      expectTextStartShowing(longPlace);
    });

    test(`shows its end at the end of the scroll, the box as wide (${name})`, async ({ page }) => {
      // Arrange: the board on air, every long text scrolled to its end at once.
      await openColumnsBoardWithLongSchools(page, textTokensScrollingToTheEndAtOnce);
      const longBox = findTeamBoxOfRow(page, rowIndex);
      const leaderPlace = await measureScrollingBox(findTeamBoxOfRow(page, 0));

      // Act: wait for the end of the scroll and measure.
      await waitForScrollPhase(longBox, 'holdingAtEnd');
      const longPlace = await measureScrollingBox(longBox);

      // Assert: still the column's width, the end of the school inside the box.
      expect(longPlace.boxWidth, 'the scroll must not change the box width').toBeCloseTo(
        leaderPlace.boxWidth,
        1,
      );
      expectTextEndShowing(longPlace);
    });
  }
});
