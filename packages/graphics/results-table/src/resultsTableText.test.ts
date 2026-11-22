/**
 * The words of a results table row, and which columns are shown
 * (packages/graphics/results-table)
 *
 * What this module is for:
 *   A result page goes on air as the site writes it (BAJAOVRLAY-83). These pure functions
 *   say what the rank cell reads, which ranks sit on the green chip, what a cell shows, and
 *   which of the page's columns "Colunas mostradas" keeps.
 *
 * What these tests prove:
 *   - The rank is the site's, "–" when it gives none; ranks 1 to 3 are on the chip, the
 *     4th and an unranked team are not.
 *   - A cell shows as written ("SPOILERS", "SIM", "–", "102.5%"), the first of two values
 *     ("55.6 / 54.9" shows "55.6"), and empty when the row lacks it.
 *   - "Colunas mostradas" keeps the columns named, in the page's order, compared without
 *     case; nothing typed, or only names the page lacks, shows every column.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the cells: resultsTable.test.ts and the e2e tests.
 */
import { describe, expect, it } from 'vitest';

import {
  chooseShownColumns,
  isOnTheMedalChip,
  writeCellText,
  writeRankText,
} from './resultsTableText.js';

/** Imperador's row with the rank given (or none). */
function buildImperadorRow(rank: number | undefined) {
  const row = { carNumber: 7, teamName: 'Imperador', schoolName: 'UTFPR-CT', cells: [] };
  return rank === undefined ? row : { ...row, rank };
}

/** The qualifying page's heads, as the site writes them. */
const qualifyingHeads = ['Voltas', 'Melhor volta', '% da média', 'Larga em', 'Pontos'];

describe('the rank cell', () => {
  const rankScenarios = [
    // The site's medal places: on the chip.
    { name: '1st reads "1", on the chip', rank: 1, text: '1', isOnTheChip: true },
    { name: '3rd reads "3", on the chip', rank: 3, text: '3', isOnTheChip: true },
    // Past the medals: the rank in yellow, no chip.
    { name: '4th reads "4", off the chip', rank: 4, text: '4', isOnTheChip: false },
    // During spoilers the site gives no rank: the dash, no chip.
    { name: 'no rank reads "–", off the chip', rank: undefined, text: '–', isOnTheChip: false },
  ];

  it.each(rankScenarios)('$name', ({ rank, text, isOnTheChip }) => {
    // Arrange: Imperador with this row's rank.
    const row = buildImperadorRow(rank);

    // Act: write the rank and ask about the chip.
    const rankText = writeRankText(row);
    const isOnTheChipNow = isOnTheMedalChip(row);

    // Assert: as the row says.
    expect(rankText, 'the rank cell must read as the site’s rank').toBe(text);
    expect(isOnTheChipNow, 'only ranks 1 to 3 sit on the green chip').toBe(isOnTheChip);
  });
});

describe('writeCellText', () => {
  const cellScenarios = [
    // Hidden by the organisers: shown as written.
    { name: 'shows SPOILERS as written', cellText: 'SPOILERS', shown: 'SPOILERS' },
    // A yes, a dash, a percentage: as written.
    { name: 'shows SIM as written', cellText: 'SIM', shown: 'SIM' },
    { name: 'shows – as written', cellText: '–', shown: '–' },
    { name: 'shows 102.5% as written', cellText: '102.5%', shown: '102.5%' },
    // Two timed laps: the first, so the column stays one value wide.
    { name: 'shows the first of two laps', cellText: '55.6 / 54.9', shown: '55.6' },
    // A row shorter than the heads: an empty cell, never "undefined".
    { name: 'shows nothing for a cell the row lacks', cellText: undefined, shown: '' },
  ];

  it.each(cellScenarios)('$name', ({ cellText, shown }) => {
    // Arrange: the cell text of this row.

    // Act: write what the cell shows.
    const textShown = writeCellText(cellText);

    // Assert: as the row says.
    expect(textShown, 'the cell must show what the row says').toBe(shown);
  });
});

describe('chooseShownColumns', () => {
  const columnScenarios = [
    // Nothing typed: every column of the page.
    {
      name: 'shows every column when nothing is typed',
      typed: '',
      expectedHeads: ['Voltas', 'Melhor volta', '% da média', 'Larga em', 'Pontos'],
    },
    // The columns named, in the page's order whatever order they are typed in.
    {
      name: 'keeps the columns named, in the page’s order',
      typed: 'Pontos, melhor volta',
      expectedHeads: ['Melhor volta', 'Pontos'],
    },
    // A typo among good names is simply ignored.
    {
      name: 'ignores a name the page does not have',
      typed: 'Pontos, Penalidades',
      expectedHeads: ['Pontos'],
    },
    // Only typos: every column, never the team alone.
    {
      name: 'shows every column when no name matches',
      typed: 'Penalidades',
      expectedHeads: ['Voltas', 'Melhor volta', '% da média', 'Larga em', 'Pontos'],
    },
  ];

  it.each(columnScenarios)('$name', ({ typed, expectedHeads }) => {
    // Arrange: the qualifying page's heads.

    // Act: choose the columns shown for what was typed.
    const shownColumns = chooseShownColumns(qualifyingHeads, typed);

    // Assert: the heads the row expects, each with its place in the cells.
    expect(
      shownColumns.map((column) => column.head),
      'the columns shown must be the row’s',
    ).toEqual(expectedHeads);
    for (const column of shownColumns) {
      expect(qualifyingHeads[column.cellIndex], 'each column keeps its own cells').toBe(
        column.head,
      );
    }
  });
});
