/**
 * The results table web component: live updates around page turns and the stop
 * (packages/graphics/results-table)
 *
 * What this module is for:
 *   A results table item is bound live to a source, so updateAction arrives every few
 *   seconds while the board turns its pages on air (BAJAOVRLAY-83). These are the
 *   standings' own cases (standings.updateAction.test.ts), ported: the table shares their
 *   page turns, so it must keep their promises.
 *
 * What these tests prove, on 26BR's Enduro page (38 rows, two pages):
 *   - An update that arrives while page 2 cascades in is not drawn on the moving rows;
 *     it is drawn once the turn has ended, so nothing is lost.
 *   - A stop that arrives during a turn ends it, and once the board is off it rests on
 *     page 1 with all its 20 rows.
 *   - Rows that shrink under page 2 on air keep page 2 while it still exists (fewer rows),
 *     and land on page 1 when it does not.
 *   - A column added on air rewrites the captions, measures the widths again (one width
 *     per column now shown) and gives every row its new cell.
 *
 * What these tests deliberately do not cover:
 *   - The real widths: jsdom draws nothing, so every width is 0 px here; the fit e2e test
 *     measures them in Chromium.
 */
import { describe, expect, it } from 'vitest';

import { createEnduroPage } from './previewData.js';
import type ResultsTableGraphic from './resultsTable.js';
import type { ResultsTableEntry } from './resultsTableModel.js';
import {
  briefArdosiaMotionTokens,
  createResultsTableOnThePage,
  listPartsOfResultsTable,
  loadResultsTableWithData,
  placeTokensOnTheRoot,
  readCaptions,
  readCarNumbersOnTheBoard,
  readPageLine,
  waitUntilThePageLineReads,
} from './resultsTableOnThePage.testSupport.js';

/** The Enduro's rows with the teams in rows `rowA` and `rowB` (from 1) trading places. */
function swapTeamsInRows(rowA: number, rowB: number): ResultsTableEntry[] {
  const rows = createEnduroPage().entries;
  const teamA = rows[rowA - 1];
  const teamB = rows[rowB - 1];
  if (teamA === undefined || teamB === undefined) {
    throw new Error('swapTeamsInRows was given a row outside the list');
  }
  rows[rowA - 1] = teamB;
  rows[rowB - 1] = teamA;
  return rows;
}

/** 26BR's Enduro on air, page 1, every motion lasting 0 ms unless a test placed tokens. */
async function createEnduroPageOnAir(): Promise<ResultsTableGraphic> {
  const resultsTable = createResultsTableOnThePage();
  await loadResultsTableWithData(resultsTable, createEnduroPage());
  await resultsTable.playAction({ skipAnimation: true });
  return resultsTable;
}

/** The board's grid, as the view wrote it on the board for every pill. */
function readGridOfTheBoard(resultsTable: ResultsTableGraphic): string {
  const board = listPartsOfResultsTable(resultsTable, 'results-table')[0];
  return board?.style.getPropertyValue('--standings-columns') ?? '';
}

describe('an update during a page turn', () => {
  it('is drawn once the turn has ended, never on the rows cascading in', async () => {
    // Arrange: brief real motion, the Enduro on air, a turn to page 2 caught as page 2
    // starts cascading in.
    placeTokensOnTheRoot(briefArdosiaMotionTokens);
    const resultsTable = await createEnduroPageOnAir();
    const pageTwoCascading = waitUntilThePageLineReads(resultsTable, '2/2 · 21º A 38º');
    const turn = resultsTable.turnToTheNextPageNow();
    await pageTwoCascading;

    // Act: the 21st and 22nd teams trade places while the rows rise in; then the turn ends.
    const answer = await resultsTable.updateAction({
      data: { entries: swapTeamsInRows(21, 22) },
    });
    const firstCarDuringTheTurn = readCarNumbersOnTheBoard(resultsTable)[0];
    await turn;

    // Assert: accepted, kept off the moving rows (UFSCar, car 15), drawn once the turn
    // ended (Piratas do Cerrado, car 19).
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(firstCarDuringTheTurn, 'during the turn the rows keep the page as drawn').toBe(15);
    expect(
      readCarNumbersOnTheBoard(resultsTable)[0],
      'once the turn has ended the update must be on the board',
    ).toBe(19);
  });
});

describe('a stop during a page turn', () => {
  it('ends the turn and rests the board on page 1 with its 20 rows', async () => {
    // Arrange: brief real motion, the Enduro on air, a turn to page 2 caught mid-cascade.
    placeTokensOnTheRoot(briefArdosiaMotionTokens);
    const resultsTable = await createEnduroPageOnAir();
    const pageTwoCascading = waitUntilThePageLineReads(resultsTable, '2/2 · 21º A 38º');
    const turn = resultsTable.turnToTheNextPageNow();
    await pageTwoCascading;

    // Act: stop the board while page 2 rises in, and let both end.
    const answer = await resultsTable.stopAction({});
    await turn;

    // Assert: off air on page 1, the 20 first rows, Imperador (car 6) first.
    expect(answer, 'the stop must answer 200').toEqual({ statusCode: 200 });
    expect(readPageLine(resultsTable), 'off air the board rests on page 1').toBe('1/2 · 1º A 20º');
    expect(readCarNumbersOnTheBoard(resultsTable), 'page 1 holds its 20 rows').toHaveLength(20);
    expect(readCarNumbersOnTheBoard(resultsTable)[0], 'Imperador first').toBe(6);
  });
});

describe('rows that shrink under page 2 on air', () => {
  it('keeps page 2 while it exists, and lands on page 1 when it no longer does', async () => {
    // Arrange: the Enduro on air, turned to page 2.
    const resultsTable = await createEnduroPageOnAir();
    await resultsTable.turnToTheNextPageNow();

    // Act: the source sends 25 rows, then 15.
    await resultsTable.updateAction({ data: { entries: createEnduroPage().entries.slice(0, 25) } });
    const pageLineWithTwentyFiveRows = readPageLine(resultsTable);
    const rowCountWithTwentyFiveRows = readCarNumbersOnTheBoard(resultsTable).length;
    await resultsTable.updateAction({ data: { entries: createEnduroPage().entries.slice(0, 15) } });

    // Assert: page 2 with its 5 rows, then the one page left.
    expect(pageLineWithTwentyFiveRows, 'page 2 stays while it exists').toBe('2/2 · 21º A 25º');
    expect(rowCountWithTwentyFiveRows, 'page 2 holds rows 21 to 25').toBe(5);
    expect(readPageLine(resultsTable), 'with 15 rows the board lands on page 1').toBe('15 EQUIPES');
    expect(readCarNumbersOnTheBoard(resultsTable), 'every row on page 1').toHaveLength(15);
  });
});

describe('a changed set of columns on air', () => {
  it('rewrites the captions and measures one width per column now shown', async () => {
    // Arrange: the Enduro on air with its two columns.
    const resultsTable = await createEnduroPageOnAir();
    const gridBefore = readGridOfTheBoard(resultsTable);

    // Act: the page gains a third column, shown with the other two.
    const rowsWithPenalties = createEnduroPage().entries.map((entry) => ({
      ...entry,
      cells: [...entry.cells, '0'],
    }));
    const answer = await resultsTable.updateAction({
      data: {
        columnHeads: ['Voltas', 'Pontos', 'Penalidades'],
        entries: rowsWithPenalties,
      },
    });

    // Assert: accepted, the new captions, and the grid with three page widths after the team.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(readCaptions(resultsTable), 'the captions of the columns now shown').toEqual([
      'POS',
      'Nº',
      'EQUIPE',
      'Voltas',
      'Pontos',
      'Penalidades',
    ]);
    expect(gridBefore, 'two widths measured before').toBe(
      'var(--column-pos) var(--chip-width) minmax(0, 1fr) 0px 0px',
    );
    expect(readGridOfTheBoard(resultsTable), 'three widths measured again').toBe(
      'var(--column-pos) var(--chip-width) minmax(0, 1fr) 0px 0px 0px',
    );
    const firstRowCells = listPartsOfResultsTable(resultsTable, 'results-table-row')[0]
      ?.firstElementChild?.children.length;
    expect(firstRowCells, 'each row has rank, car, team and the three cells').toBe(6);
  });
});
