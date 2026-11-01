/**
 * Bracket: a team and school too long for the match card scroll inside it
 * (packages/graphics/bracket, Playwright)
 *
 * What this module is for:
 *   A car on a round board's match card shows its team with its school after it. The
 *   longest schools of the Baja field are far wider than a card's team box; instead of an
 *   ellipsis the two scroll together inside it (BAJAOVRLAY-55), every car on one cycle.
 *   This is the real thing in Chromium, measured, at the size OBS draws it.
 *
 * What these tests prove, on the results board (six matches), the first car of the first
 * match given "Universidade Tecnológica Federal do Paraná - Cornélio Procópio", and the first
 * car of the second and the right-hand car of the last "Instituto Federal de Educação,
 * Ciência e Tecnologia Fluminense - IFF - Campus Itaperuna" as schools (a right-hand car's
 * side is right-aligned while its line fits):
 *   - The team box keeps its width: as wide as the same card's box with the real short school.
 *   - At rest the start of the line (the team name) shows at the box's left edge.
 *   - At the end of the scroll the end of the school shows inside the box, clear of the
 *     fade, the box still as wide.
 *
 * What these tests deliberately do not cover:
 *   - The tree's pills, drawn by the same renderCarTeam (bracketCarView.ts).
 *   - The cycle's timing: the theme's tokens are overridden so the text rests for ten
 *     minutes, or reaches its end at once; the kit's unit tests cover the timing.
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

import type { BracketData } from '../src/bracketModel.js';

/**
 * A round board of six decided matches, the preview's results board (previewData.ts, which
 * the browser tests cannot import: it reads a JSON sample), with the given schools for the
 * first car of the first two matches.
 */
function createResultsBoard(firstSchool: string, secondSchool: string): BracketData {
  const buffalo = { carNumber: 34, teamName: 'Buffalo', schoolName: 'UFLA' };
  const caraubaja = { carNumber: 9, teamName: 'Caraubaja', schoolName: 'UFERSA-Car' };
  const corisco = { carNumber: 32, teamName: 'Corisco', schoolName: 'UPE' };
  return {
    title: 'SUPER PRIME',
    rounds: [
      {
        name: 'Resultados',
        matches: [
          {
            matchId: 'tempo',
            carA: { carNumber: 32, teamName: 'Corisco', schoolName: firstSchool, timeMs: 71_340 },
            carB: { ...buffalo, timeMs: 74_910 },
            winnerCarNumber: 32,
          },
          {
            matchId: 'melhor-de-3',
            bestOf: 3,
            carA: { carNumber: 17, teamName: 'Bombaja', schoolName: secondSchool, wins: 2 },
            carB: { ...caraubaja, wins: 1 },
            winnerCarNumber: 17,
          },
          { matchId: 'vitoria', carA: corisco, carB: buffalo, winnerCarNumber: 32 },
          { matchId: 'wo', walkover: true, carA: corisco, carB: buffalo, winnerCarNumber: 32 },
          { matchId: 'sem-adversario', walkover: true, carA: corisco, winnerCarNumber: 32 },
          {
            matchId: 'antes-de-decidir',
            carA: corisco,
            carB: { carNumber: 47, teamName: 'Goytacá Baja', schoolName: secondSchool },
          },
        ],
      },
    ],
  };
}

/** The results board with real short schools: UPE and UFSM. */
function createResultsBoardWithShortSchools(): BracketData {
  return createResultsBoard('UPE', 'UFSM');
}

/** The results board with the longest schools of the field on the first two cars. */
function createResultsBoardWithTheLongestSchools(): BracketData {
  return createResultsBoard(
    longestBajaSchoolNames.utfprCornelioProcopio,
    longestBajaSchoolNames.iffItaperuna,
  );
}

/** Opens the bracket on air with the data, the given text tokens in force. */
async function openBracketOnAir(
  page: Page,
  data: BracketData,
  textTokens: Record<string, string>,
): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokens);
  await page.goto(buildPreviewAddressWithData(data));
  await expect(page.locator('body'), 'the bracket must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The team box of a match's first car, found by its team's name. */
function findTeamBoxOfTheFirstCar(page: Page, teamName: string) {
  return page.getByTestId('bracket-team').filter({ hasText: teamName }).first();
}

/** The width of the team's box on the results board as the preview draws it, short school. */
async function measureBoxWidthWithTheShortSchool(page: Page, teamName: string): Promise<number> {
  await openBracketOnAir(page, createResultsBoardWithShortSchools(), textTokensHoldingAtTheStart);
  const place = await measureScrollingBox(findTeamBoxOfTheFirstCar(page, teamName));
  return place.boxWidth;
}

const longSchoolCars = [
  // Corisco, first car of the first match, given the longest school in the field.
  { name: 'Universidade Tecnológica Federal do Paraná - Cornélio Procópio', teamName: 'Corisco' },
  // Bombaja, first car of the second match, given the longest name of all.
  { name: 'Instituto Federal de Educação, Ciência e Tecnologia Fluminense', teamName: 'Bombaja' },
  // Goytacá Baja, the right-hand car of the last match: its side is right-aligned, and a
  // line too long must still start at the box's left edge, not overflow to the left.
  { name: 'the right-hand car, Instituto Federal Fluminense', teamName: 'Goytacá Baja' },
];

test.describe('a car whose school is too long for the match card', () => {
  for (const { name, teamName } of longSchoolCars) {
    test(`shows its start at rest, the box as wide as before (${name})`, async ({ page }) => {
      // Arrange: the box's width with the real short school, then the long school on air,
      // every long text held at its start.
      const widthWithTheShortSchool = await measureBoxWidthWithTheShortSchool(page, teamName);
      await openBracketOnAir(
        page,
        createResultsBoardWithTheLongestSchools(),
        textTokensHoldingAtTheStart,
      );
      const longBox = findTeamBoxOfTheFirstCar(page, teamName);
      await waitForScrollPhase(longBox, 'holdingAtStart');

      // Act: measure the box with the long school.
      const longPlace = await measureScrollingBox(longBox);

      // Assert: the same width as with the short school, the start of the line showing.
      expect(longPlace.boxWidth, 'the long school must not widen the box').toBeCloseTo(
        widthWithTheShortSchool,
        1,
      );
      expectTextStartShowing(longPlace);
    });

    test(`shows its end at the end of the scroll, the box as wide (${name})`, async ({ page }) => {
      // Arrange: the box's width with the real short school, then the long school on air,
      // every long text scrolled to its end at once.
      const widthWithTheShortSchool = await measureBoxWidthWithTheShortSchool(page, teamName);
      await openBracketOnAir(
        page,
        createResultsBoardWithTheLongestSchools(),
        textTokensScrollingToTheEndAtOnce,
      );
      const longBox = findTeamBoxOfTheFirstCar(page, teamName);

      // Act: wait for the end of the scroll and measure.
      await waitForScrollPhase(longBox, 'holdingAtEnd');
      const longPlace = await measureScrollingBox(longBox);

      // Assert: still as wide, the end of the school inside the box.
      expect(longPlace.boxWidth, 'the scroll must not change the box width').toBeCloseTo(
        widthWithTheShortSchool,
        1,
      );
      expectTextEndShowing(longPlace);
    });
  }
});
