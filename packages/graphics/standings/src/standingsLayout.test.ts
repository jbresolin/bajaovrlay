/**
 * Which board and which teams on which page (packages/graphics/standings)
 *
 * What this module is for:
 *   standingsLayout.ts chooses the board from the data (the overall table when there are
 *   score parts, three columns of 20 when there are none), cuts the list into pages (20
 *   teams in the table, 60 in columns), splits a columns page into its columns, and writes
 *   the head's page line ("2/3 · 21º A 40º", or "33 EQUIPES" on a single page).
 *
 * What these tests prove:
 *   - The board follows the data: parts give the table, no parts the columns.
 *   - The real 54-team export pages in three in the table, with the page lines of the
 *     design (rows counted by position on the page, not by rank, since ranks tie), the
 *     four disqualified teams on page 3.
 *   - In columns 54 teams fit one page as 20, 20 and 14, the enduro's 33 as 20 and 13 (no
 *     empty third column), and 61 teams page by 60: 3 × 20 then 1.
 *   - A page asked past the end of a list that shrank lands on the last page; the cycle
 *     goes back to page 1 after the last.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the page; standingsView.test.ts does. The texts of a row; standingsText.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  createEnduroStandings,
  createOverallStandingsEntries,
  overallScoreParts,
} from './previewData.js';
import {
  chooseNextPageInCycle,
  chooseStandingsLayout,
  keepPageInsideTheList,
  layOutStandingsPage,
  writePageLine,
} from './standingsLayout.js';
import { createOverallEntriesWithSevenLateEntrants } from './standingsOnThePage.testSupport.js';

describe('chooseStandingsLayout', () => {
  it('chooses the table when the data carries score parts, and the columns when it does not', () => {
    // Arrange: the export's six parts, and no parts at all.
    const sixParts = overallScoreParts;

    // Act: choose the board for each.
    const layoutWithParts = chooseStandingsLayout(sixParts);
    const layoutWithoutParts = chooseStandingsLayout([]);

    // Assert: parts give the table, no parts the columns.
    expect(layoutWithParts, 'score parts must give the overall table').toBe('table');
    expect(layoutWithoutParts, 'no score parts must give the board in columns').toBe('columns');
  });
});

describe('the overall table, 20 teams a page', () => {
  const tablePageScenarios = [
    // Page 1: the leader, Baja UFMG (car 2), down to the 20th, car 12.
    {
      name: 'page 1 holds rows 1 to 20 and says "1/3 · 1º A 20º"',
      pageNumber: 1,
      expectedLine: '1/3 · 1º A 20º',
      expectedFirstCar: 2,
      expectedRowCount: 20,
    },
    // Page 2 starts at the 21st row, Reptiles Baja PUC-Rio (car 7).
    {
      name: 'page 2 holds rows 21 to 40 and says "2/3 · 21º A 40º"',
      pageNumber: 2,
      expectedLine: '2/3 · 21º A 40º',
      expectedFirstCar: 7,
      expectedRowCount: 20,
    },
    // Page 3 has the last 14: ITA Baja (car 52) down to the four disqualified teams.
    {
      name: 'page 3 holds rows 41 to 54 and says "3/3 · 41º A 54º"',
      pageNumber: 3,
      expectedLine: '3/3 · 41º A 54º',
      expectedFirstCar: 52,
      expectedRowCount: 14,
    },
  ];

  it.each(tablePageScenarios)(
    '$name',
    ({ pageNumber, expectedLine, expectedFirstCar, expectedRowCount }) => {
      // Arrange: the 54 teams of the real export.
      const entries = createOverallStandingsEntries();

      // Act: lay out the asked page of the table.
      const page = layOutStandingsPage(entries, 'table', pageNumber);

      // Assert: three pages, one table, the right rows and the design's page line.
      expect(page.pageCount, '54 teams must take three pages of 20').toBe(3);
      expect(page.columns, 'the table is a single column').toHaveLength(1);
      expect(page.columns[0]?.[0]?.carNumber, 'the page must start at the right team').toBe(
        expectedFirstCar,
      );
      expect(page.columns[0], 'the page must hold the right number of rows').toHaveLength(
        expectedRowCount,
      );
      expect(page.pageLine, 'the head must say the page and the rows on it').toBe(expectedLine);
    },
  );

  it('puts the four disqualified teams at the end of page 3', () => {
    // Arrange: the 54 teams of the real export.
    const entries = createOverallStandingsEntries();

    // Act: lay out page 3.
    const page = layOutStandingsPage(entries, 'table', 3);

    // Assert: the last four rows are the disqualified cars 30, 42, 48 and 57.
    const lastFourRows = page.columns[0]?.slice(-4) ?? [];
    expect(
      lastFourRows.map((entry) => [entry.carNumber, entry.isDisqualified]),
      'the disqualified teams must close the last page',
    ).toEqual([
      [30, true],
      [42, true],
      [48, true],
      [57, true],
    ]);
  });
});

describe('the board in columns, 60 teams a page', () => {
  it('splits the 54 overall teams into columns of 20, 20 and 14 on a single page', () => {
    // Arrange: the 54 teams, sent with their totals alone.
    const entries = createOverallStandingsEntries();

    // Act: lay out the columns board.
    const page = layOutStandingsPage(entries, 'columns', 1);

    // Assert: one page, three columns filled top to bottom, the line counting the teams.
    expect(page.pageCount, '54 teams fit on one columns page').toBe(1);
    expect(
      page.columns.map((column) => column.length),
      'the columns fill 20 at a time, left to right',
    ).toEqual([20, 20, 14]);
    expect(page.columns[1]?.[0]?.carNumber, 'the middle column starts at the 21st team').toBe(7);
    expect(page.pageLine, 'a single page names the number of teams').toBe('54 EQUIPES');
  });

  it('draws the enduro’s 33 teams in two columns, with no empty third', () => {
    // Arrange: the enduro's own table.
    const entries = createEnduroStandings().entries;

    // Act: lay out the columns board.
    const page = layOutStandingsPage(entries, 'columns', 1);

    // Assert: 20 and 13, as standings-por-prova shows, and "33 EQUIPES".
    expect(
      page.columns.map((column) => column.length),
      'a column with no team is left out',
    ).toEqual([20, 13]);
    expect(page.pageLine, 'the line counts the teams').toBe('33 EQUIPES');
  });

  it('pages 61 teams by 60: three full columns, then a page with the 61st alone', () => {
    // Arrange: the 54 teams plus seven late entrants.
    const entries = createOverallEntriesWithSevenLateEntrants();

    // Act: lay out both pages.
    const pageOne = layOutStandingsPage(entries, 'columns', 1);
    const pageTwo = layOutStandingsPage(entries, 'columns', 2);

    // Assert: two pages, 3 × 20 then 1, each with its page line.
    expect(pageOne.pageCount, '61 teams take two columns pages').toBe(2);
    expect(
      pageOne.columns.map((column) => column.length),
      'page 1 holds three full columns',
    ).toEqual([20, 20, 20]);
    expect(pageOne.pageLine, 'page 1 says its rows').toBe('1/2 · 1º A 60º');
    expect(
      pageTwo.columns.map((column) => column.length),
      'page 2 holds the one team left',
    ).toEqual([1]);
    expect(pageTwo.pageLine, 'page 2 says its one row').toBe('2/2 · 61º A 61º');
  });
});

describe('the page line on one page', () => {
  it('names one team in the singular and many in the plural', () => {
    // Arrange: a board with one team and one with twelve.

    // Act: write both lines.
    const oneTeamLine = writePageLine(1, 1, 'table');
    const twelveTeamsLine = writePageLine(1, 12, 'table');

    // Assert: "1 EQUIPE" and "12 EQUIPES".
    expect(oneTeamLine, 'one team reads in the singular').toBe('1 EQUIPE');
    expect(twelveTeamsLine, 'twelve teams read in the plural').toBe('12 EQUIPES');
  });
});

describe('keeping the page inside the list', () => {
  it('lands on the last page when the list shrank under the page on air', () => {
    // Arrange: page 3 was on air, and the list now has 30 teams (two table pages).

    // Act: keep page 3 inside the 30-team list.
    const pageNumber = keepPageInsideTheList(3, 30, 'table');

    // Assert: page 2, the last there is.
    expect(pageNumber, 'a page past the end must become the last page').toBe(2);
  });

  it('goes back to page 1 after the last page of the cycle', () => {
    // Arrange: a three-page table on its third page.

    // Act: choose the next page after 3, and after 1.
    const pageAfterTheLast = chooseNextPageInCycle(3, 3);
    const pageAfterTheFirst = chooseNextPageInCycle(1, 3);

    // Assert: 1 after 3, 2 after 1.
    expect(pageAfterTheLast, 'the cycle must come back to page 1').toBe(1);
    expect(pageAfterTheFirst, 'page 2 comes after page 1').toBe(2);
  });
});
