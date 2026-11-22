/**
 * "Ordenar por" and "Sentido": the rows ordered by one column (packages/graphics/results-table)
 *
 * What this module is for:
 *   João's addition to BAJAOVRLAY-83: an item may order the rows of a result page by any of
 *   its columns, ascending or descending, instead of the site's order. Cells are text as
 *   the site writes them, so a number is read from each where one can be; a cell with no
 *   number goes last. Only the order changes: the rank shown is always the site's.
 *
 * What these tests prove:
 *   - The number read from each kind of cell the site writes ("57.3", "102.5%", "6º",
 *     "-15", "1:02.3", the first of "55.6 / 54.9"), and none from "SPOILERS", "–", "SIM",
 *     "-" or an empty cell.
 *   - Rows ordered by a column, each scenario named for the rule it proves: numbers either
 *     way, cells with no number last either way, two of them as pt-BR text, ties in the
 *     site's order, the fixed columns (Pos, #, Equipe), names compared without case or
 *     accents and found by their start, and
 *     the site's order for nothing typed, "Ordem do site" or a column the page lacks.
 *   - The list given is left as it was, ranks included.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the ordered rows on the board: resultsTable.test.ts and the screenshots.
 */
import { describe, expect, it } from 'vitest';

import type { ResultsTableEntry } from './resultsTableModel.js';
import { orderRowsByColumn, readNumberFromCellText } from './resultsTableSorting.js';

/** A qualifying page's heads, as the site writes them. */
const qualifyingHeads = [
  'Voltas',
  'Melhor volta',
  '% da média',
  'Classificado (≤115%)',
  'Larga em',
];

/**
 * Five teams of a qualifying page, in the site's order, ranked by the site: Imperador
 * 1st, Guaicurus 2nd, Sagui 3rd, then Pato out of the 115% and Procobaja with no time yet.
 */
function buildQualifyingRows(): ResultsTableEntry[] {
  return [
    {
      rank: 1,
      carNumber: 7,
      teamName: 'Imperador',
      schoolName: 'UTFPR-CT',
      cells: ['51.9 / 52.3', '51.9', '91.8%', 'SIM', '1º'],
    },
    {
      rank: 2,
      carNumber: 5,
      teamName: 'Guaicurus',
      schoolName: 'UFGD',
      cells: ['52.7', '52.7', '93.2%', 'SIM', '2º'],
    },
    {
      rank: 3,
      carNumber: 2,
      teamName: 'Sagui',
      schoolName: 'UFPR',
      cells: ['53.1', '52.7', '93.9%', 'SIM', '3º'],
    },
    {
      rank: 4,
      carNumber: 12,
      teamName: 'Pato',
      schoolName: 'UTFPR-PB',
      cells: ['66.4', '66.4', '117.5%', 'NÃO', '-'],
    },
    {
      carNumber: 1,
      teamName: 'Procobaja',
      schoolName: 'UTFPR-CP',
      cells: ['–', '–', '–', 'SPOILERS', '-'],
    },
  ];
}

/** The car numbers of rows, in order: how each scenario's order is written. */
function listCarNumbers(rows: ResultsTableEntry[]): number[] {
  return rows.map((row) => row.carNumber);
}

describe('readNumberFromCellText', () => {
  const cellScenarios = [
    // A lap time or points, the plain case.
    { name: 'reads 57.3', cellText: '57.3', expected: 57.3 },
    // A penalty, negative.
    { name: 'reads -15', cellText: '-15', expected: -15 },
    // "% da média".
    { name: 'reads 102.5 from 102.5%', cellText: '102.5%', expected: 102.5 },
    // "Larga em": an ordinal.
    { name: 'reads 6 from 6º', cellText: '6º', expected: 6 },
    // Two timed laps in one cell: the first is the one shown, so the one compared.
    { name: 'reads the first of two values', cellText: '55.6 / 54.9', expected: 55.6 },
    // A lap over a minute, written as minutes and seconds.
    { name: 'reads 1:02.3 as 62.3 seconds', cellText: '1:02.3', expected: 62.3 },
    // A hidden value.
    { name: 'reads nothing from SPOILERS', cellText: 'SPOILERS', expected: undefined },
    // The site's mark for no value.
    { name: 'reads nothing from –', cellText: '–', expected: undefined },
    // "Larga em" of a team that does not start: a hyphen alone is not -0.
    { name: 'reads nothing from a hyphen alone', cellText: '-', expected: undefined },
    // A yes.
    { name: 'reads nothing from SIM', cellText: 'SIM', expected: undefined },
    // An empty cell.
    { name: 'reads nothing from an empty cell', cellText: '', expected: undefined },
  ];

  it.each(cellScenarios)('$name', ({ cellText, expected }) => {
    // Arrange: the cell text of this row.

    // Act: read a number from it.
    const cellNumber = readNumberFromCellText(cellText);

    // Assert: the number the row expects, or none.
    expect(cellNumber, 'the number read must be the row’s').toBe(expected);
  });
});

describe('orderRowsByColumn', () => {
  const orderScenarios = [
    // Nothing typed: the site's order, untouched.
    {
      name: 'keeps the site’s order when nothing is typed',
      sortBy: '',
      direction: 'ascending' as const,
      expectedCars: [7, 5, 2, 12, 1],
    },
    // The words the description gives for the site's order, in any case.
    {
      name: 'keeps the site’s order for "ordem do site"',
      sortBy: 'ordem do site',
      direction: 'descending' as const,
      expectedCars: [7, 5, 2, 12, 1],
    },
    // A typo never reorders the board into something nobody asked for.
    {
      name: 'keeps the site’s order for a column the page does not have',
      sortBy: 'Penalidades',
      direction: 'descending' as const,
      expectedCars: [7, 5, 2, 12, 1],
    },
    // Numbers, smallest first; the cell with "–" last; Guaicurus and Sagui tie on 52.7
    // and keep the site's order.
    {
      name: 'orders by best lap ascending, the tie in the site’s order, no time last',
      sortBy: 'Melhor volta',
      direction: 'ascending' as const,
      expectedCars: [7, 5, 2, 12, 1],
    },
    // Descending: the numbers turn round, the tie does not, and "–" stays last.
    {
      name: 'orders by best lap descending, the tie still in the site’s order, no time last',
      sortBy: 'Melhor volta',
      direction: 'descending' as const,
      expectedCars: [12, 5, 2, 7, 1],
    },
    // Percentages read as numbers; the name typed in other case and spacing.
    {
      name: 'orders by "% da média" typed in lower case with spaces around it',
      sortBy: '  % DA MÉDIA ',
      direction: 'descending' as const,
      expectedCars: [12, 2, 5, 7, 1],
    },
    // No accent and a start, as for "Colunas mostradas": "% da media" means "% da média".
    {
      name: 'orders by "% da media" typed without the accent',
      sortBy: '% da media',
      direction: 'ascending' as const,
      expectedCars: [7, 5, 2, 12, 1],
    },
    // The start of a long head, which one head alone has.
    {
      name: 'orders by "classificado", the start of one head',
      sortBy: 'classificado',
      direction: 'ascending' as const,
      expectedCars: [12, 7, 5, 2, 1],
    },
    // Ordinals read as numbers; the two hyphens have no number, last, as pt-BR text tie.
    {
      name: 'orders by "Larga em", the teams with no grid place last',
      sortBy: 'Larga em',
      direction: 'descending' as const,
      expectedCars: [2, 5, 7, 12, 1],
    },
    // A column of text only: pt-BR text order, in the direction chosen.
    {
      name: 'orders a column of words as pt-BR text',
      sortBy: 'Classificado (≤115%)',
      direction: 'ascending' as const,
      expectedCars: [12, 7, 5, 2, 1],
    },
    // The first of two values decides: 51.9 before 52.7.
    {
      name: 'orders by laps on the first of two values',
      sortBy: 'Voltas',
      direction: 'ascending' as const,
      expectedCars: [7, 5, 2, 12, 1],
    },
    // The site's own Pos column: by rank, the unranked team last.
    {
      name: 'orders by "Pos" descending, the team with no rank still last',
      sortBy: 'Pos',
      direction: 'descending' as const,
      expectedCars: [12, 2, 5, 7, 1],
    },
    // The site's "#" column: by car number.
    {
      name: 'orders by "#" ascending',
      sortBy: '#',
      direction: 'ascending' as const,
      expectedCars: [1, 2, 5, 7, 12],
    },
    // The site's "Equipe" column: by team name, as pt-BR text.
    {
      name: 'orders by "Equipe" ascending',
      sortBy: 'Equipe',
      direction: 'ascending' as const,
      expectedCars: [5, 7, 12, 1, 2],
    },
  ];

  it.each(orderScenarios)('$name', ({ sortBy, direction, expectedCars }) => {
    // Arrange: the five teams in the site's order.
    const rows = buildQualifyingRows();

    // Act: order them by the column and direction of this row.
    const orderedRows = orderRowsByColumn(rows, qualifyingHeads, sortBy, direction);

    // Assert: the cars in the order the row expects.
    expect(listCarNumbers(orderedRows), 'the rows must come in the expected order').toEqual(
      expectedCars,
    );
  });

  it('leaves the list given as it was, the site’s ranks on every row', () => {
    // Arrange: the five teams, and a copy to compare with.
    const rows = buildQualifyingRows();
    const rowsBefore = buildQualifyingRows();

    // Act: order them by best lap, descending.
    const orderedRows = orderRowsByColumn(rows, qualifyingHeads, 'Melhor volta', 'descending');

    // Assert: the list given unchanged, and Pato, first now, still ranked 4th by the site.
    expect(rows, 'the list given must not change').toEqual(rowsBefore);
    expect(orderedRows[0]?.rank, 'the rank shown stays the site’s').toBe(4);
  });
});
