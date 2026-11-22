/**
 * A table answer read whole, every column as text (packages/shared)
 *
 * What this module is for:
 *   The results table (BAJAOVRLAY-83) shows a result page with its own columns, every cell
 *   as the site writes it. The mapping option `cellsAsTextFromColumns` lists the columns
 *   kept once (their heads) and reads each row's cells as text, trying `display` then `raw`.
 *
 * What these tests prove:
 *   - Every kind of cell value becomes the text the table shows: text cleaned up, numbers
 *     with at most two decimals, yes and no in pt-BR, and nothing as "".
 *   - The columns named by the condition (rank, car, team) are left out, the others kept
 *     in order with their cleaned-up heads, a column with no title kept with "".
 *   - A cell's `display` wins over its `raw`; `raw` is read when there is no `display`; a
 *     row shorter than the columns gives "" for the missing cells.
 *   - The option sits on the results table only, and the results table needs it.
 *
 * What these tests deliberately do not cover:
 *   - The whole preset on the Baja app's answers: bajaAppResultsPagePreset.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { FlexShapeMappingSchema } from './flexMappingConfig.js';
import type { FlexCellsAsTextFromColumns, FlexTableLayout } from './flexMappingListOptions.js';
import {
  listColumnsReadAsText,
  readCellsOfEntryAsText,
  writeCellValueAsText,
} from './resultsTableCellsFromColumns.js';

/** Where the Baja app keeps its columns and cells. */
const bajaAppTableLayout: FlexTableLayout = {
  columnsPath: 'columns',
  headerPath: 'header',
  cellsPath: 'cells',
};

/** The preset's reading: `display`, else `raw`, the rank, car and team columns left out. */
const presetCellsAsText: FlexCellsAsTextFromColumns = {
  valuePaths: ['display', 'raw'],
  leaveOutColumnsWhen: { path: 'kind', isOneOf: ['position', 'team_number', 'team'] },
};

/** A qualifying page's columns, one of them with no title. */
function buildQualifyingPageColumns() {
  return {
    columns: [
      { header: 'Pos', kind: 'position' },
      { header: '#', kind: 'team_number' },
      { header: 'Equipe', kind: 'team' },
      { header: 'Voltas ', kind: 'formula' },
      { header: null, kind: 'formula' },
      { header: '% da média', kind: 'formula' },
    ],
  };
}

describe('writeCellValueAsText', () => {
  const valueScenarios = [
    // The usual case: the site's own text, kept as written.
    { name: 'keeps "SPOILERS" as written', value: 'SPOILERS', expected: 'SPOILERS' },
    // Two values in one cell stay two values: the graphic decides what to show.
    { name: 'keeps two lap times as written', value: '55.6 / 54.9', expected: '55.6 / 54.9' },
    // Text from the API is cleaned up like every other text a mapping writes.
    { name: 'trims and collapses the spaces', value: '  102.5%&nbsp;', expected: '102.5%' },
    // A negative number, as Segurança writes a penalty.
    { name: 'writes -15 for a penalty', value: -15, expected: '-15' },
    // An old answer's raw float noise must not reach the air.
    { name: 'rounds float noise to two decimals', value: 252.39999999999998, expected: '252.4' },
    // A whole number stays whole.
    { name: 'writes 400 without decimals', value: 400, expected: '400' },
    // A yes or a no, in the words the site uses.
    { name: 'writes true as SIM', value: true, expected: 'SIM' },
    { name: 'writes false as NÃO', value: false, expected: 'NÃO' },
    // Nothing known: an empty cell, never "null".
    { name: 'writes null as an empty cell', value: null, expected: '' },
    // Something no cell should hold: empty, never refused.
    { name: 'writes an object as an empty cell', value: { lap: 3 }, expected: '' },
  ];

  it.each(valueScenarios)('$name', ({ value, expected }) => {
    // Arrange: the value of this row.

    // Act: write it as text.
    const text = writeCellValueAsText(value);

    // Assert: the text the row expects.
    expect(text, 'the cell must read as the row says').toBe(expected);
  });
});

describe('listColumnsReadAsText', () => {
  it('leaves out the rank, car and team columns and keeps the rest in order', () => {
    // Arrange: the qualifying page's columns.
    const response = buildQualifyingPageColumns();

    // Act: list the columns kept.
    const columnsKept = listColumnsReadAsText(bajaAppTableLayout, presetCellsAsText, response);

    // Assert: three value columns, heads cleaned up, the untitled one kept as "".
    expect(columnsKept, 'the value columns, at their places in the cells').toEqual([
      { head: 'Voltas', columnPlace: 3 },
      { head: '', columnPlace: 4 },
      { head: '% da média', columnPlace: 5 },
    ]);
  });

  it('answers undefined when the answer has no list of columns', () => {
    // Arrange: an answer without columns.
    const response = { rows: [] };

    // Act: list the columns.
    const columnsKept = listColumnsReadAsText(bajaAppTableLayout, presetCellsAsText, response);

    // Assert: nothing to read.
    expect(columnsKept, 'no columns list means no columns').toBeUndefined();
  });
});

describe('readCellsOfEntryAsText', () => {
  it('reads display before raw, raw without display, and "" past the end of a short row', () => {
    // Arrange: the columns kept, and Imperador's row with its last cell missing.
    const columnsKept = [
      { head: 'Voltas', columnPlace: 3 },
      { head: 'Melhor volta', columnPlace: 4 },
      { head: 'Pontos', columnPlace: 5 },
    ];
    const cellsOfImperador = [
      { raw: 1, display: '1º' },
      { raw: 7, display: 7 },
      { raw: 'Imperador', display: 'Imperador' },
      { raw: 51.9, display: '51.9 / 52.3' },
      { raw: 51.9 },
    ];

    // Act: read the row's cells as text.
    const cells = readCellsOfEntryAsText(cellsOfImperador, columnsKept, presetCellsAsText);

    // Assert: the display, the raw, and an empty cell where the row ends.
    expect(cells, 'one text per column kept').toEqual(['51.9 / 52.3', '51.9', '']);
  });
});

describe('where cellsAsTextFromColumns may sit', () => {
  /** A results table mapping as the preset writes it, minus its rules but one. */
  function buildResultsTableMapping() {
    return {
      shapeKey: 'resultsTable',
      requestId: 'resultado',
      entriesPath: 'rows',
      table: bajaAppTableLayout,
      cellsAsTextFromColumns: presetCellsAsText,
      fields: [{ targetField: 'updatedAtMs', fromPollMoment: true }],
      entryFields: [{ targetField: 'carNumber', fromPath: 'team.number' }],
    };
  }

  it('accepts it on the results table with a table layout', () => {
    // Arrange: the results table mapping.
    const mapping = buildResultsTableMapping();

    // Act: check it as a saved config is checked.
    const check = FlexShapeMappingSchema.safeParse(mapping);

    // Assert: accepted.
    expect(check.success, 'the results table with its cells must be accepted').toBe(true);
  });

  it('refuses a results table without it, since its heads come from nowhere else', () => {
    // Arrange: the mapping without the option.
    const mapping: Record<string, unknown> = buildResultsTableMapping();
    delete mapping.cellsAsTextFromColumns;

    // Act: check it.
    const check = FlexShapeMappingSchema.safeParse(mapping);

    // Assert: refused with the sentence that names the option.
    expect(check.error?.issues[0]?.message, 'the reason names the missing option').toBe(
      'A Tabela de resultado precisa das células como texto, coluna por coluna ("cellsAsTextFromColumns").',
    );
  });

  it('refuses it on the standings', () => {
    // Arrange: the same option on a standings mapping.
    const mapping = { ...buildResultsTableMapping(), shapeKey: 'standings', fields: [] };

    // Act: check it.
    const check = FlexShapeMappingSchema.safeParse(mapping);

    // Assert: refused, saying where the option belongs.
    const messages = check.error?.issues.map((issue) => issue.message) ?? [];
    expect(messages, 'the reason says the option is the results table’s').toContain(
      'As células como texto, coluna por coluna, só existem na Tabela de resultado.',
    );
  });
});
