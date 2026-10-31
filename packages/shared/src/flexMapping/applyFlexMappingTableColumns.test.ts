/**
 * Reading a table by its column headers (packages/shared)
 *
 * What this module is for:
 *   The Baja app's results tables are `columns[]` (each with a header) plus `rows[].cells[]`,
 *   one cell per column by position. A path such as `cells[9].raw` breaks as soon as the
 *   organisers add a column, so a mapping may say where the columns, their headers and each
 *   row's cells are (`table`), and a rule reads `fromColumn: { header, path }`. Standings'
 *   parts of the score are built from a list of headers the operator picks, each header
 *   being the part's label and id (BAJAOVRLAY-53).
 *
 * What these tests prove:
 *   - The real 26BR overall table gives Poli Baja (car 5) its total and its five parts,
 *     and the standings' parts come in the order the operator picked them.
 *   - A column the organisers add in the middle shifts nothing: the same values are read.
 *   - A header the answer does not have is one problem naming it, not one per row.
 *   - A part whose cell holds no value is left out, its column kept; a part whose cell
 *     holds text is a problem naming the team, the column and the value.
 *
 * What these tests deliberately do not cover:
 *   - Refusing a table during spoilers: applyFlexMappingRefusalFlag.test.ts.
 *   - The whole 26BR table through validateDataShape: bajaAppFixtures.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { applyFlexMapping } from './applyFlexMapping.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from './bajaAppFixtures.testSupport.js';
import { FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The moment of the poll in these tests: the last day of the 26BR competition. */
const pollMomentMs = Date.UTC(2026, 2, 29, 18, 0, 0);

/** The parts of 26BR's overall score, as the operator picks them. */
const partHeadersOf26BR = ['Penalidade', 'Segurança', 'Projeto', 'Dinâmicas', 'Enduro'];

/** A standings mapping reading the total and the parts by column header. */
function buildTableMapping(partHeaders: string[], totalHeader = 'Total') {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'standings',
      requestId: 'resultado',
      entriesPath: 'rows',
      table: { columnsPath: 'columns', headerPath: 'header', cellsPath: 'cells' },
      scorePartsFromColumns: { headers: partHeaders, valuePath: 'raw' },
      fields: [],
      entryFields: [
        { targetField: 'carNumber', fromPath: 'team.number' },
        { targetField: 'points', fromColumn: { header: totalHeader, path: 'raw' } },
      ],
    },
  ]);
}

/** The real 26BR overall table cut to its first row, Poli Baja (car 5). */
function readFirstRowOf26BR(): { columns: unknown[]; rows: unknown[] } {
  const table = readBajaAppFixture(bajaAppFixtureFiles.overall26BR) as {
    columns: unknown[];
    rows: unknown[];
  };
  return { columns: table.columns, rows: table.rows.slice(0, 1) };
}

/** Poli Baja's standings as the real 26BR table has them, total and parts. */
const poliBajaStandings = {
  scoreParts: partHeadersOf26BR.map((header) => ({ partId: header, label: header })),
  entries: [
    {
      carNumber: 5,
      points: 816.24,
      pointsByPart: {
        Penalidade: 0,
        Segurança: -5,
        Projeto: 252.39999999999998,
        Dinâmicas: 238.41,
        Enduro: 330.43,
      },
    },
  ],
};

describe('applyFlexMapping, table columns', () => {
  it('reads Poli Baja’s total and parts from the real 26BR table by header', () => {
    // Arrange: the table mapping and the first row of the real 26BR overall table.
    const mappings = buildTableMapping(partHeadersOf26BR);

    // Act: map it.
    const result = applyFlexMapping(mappings, { resultado: readFirstRowOf26BR() }, pollMomentMs);

    // Assert: the total and each part read from its own column, the parts in picked order.
    expect(result, 'every value must come from the column its header names').toEqual({
      ok: true,
      shapes: { standings: poliBajaStandings },
    });
  });

  it('reads the same values after the organisers add a column in the middle', () => {
    // Arrange: the same row with a "Bônus 4x4" column added before "Total".
    const mappings = buildTableMapping(partHeadersOf26BR);
    const table = readFirstRowOf26BR() as {
      columns: unknown[];
      rows: Array<{ cells: unknown[] }>;
    };
    const totalPlace = table.columns.length - 1;
    table.columns.splice(totalPlace, 0, { header: 'Bônus 4x4', kind: 'formula', ranking: false });
    table.rows[0]?.cells.splice(totalPlace, 0, { raw: 40 });

    // Act: map it.
    const result = applyFlexMapping(mappings, { resultado: table }, pollMomentMs);

    // Assert: exactly what the table gave before the column was added.
    expect(result, 'a new column must shift nothing').toEqual({
      ok: true,
      shapes: { standings: poliBajaStandings },
    });
  });

  it('names a header the answer does not have, once for the whole table', () => {
    // Arrange: parts that include 25SU's "Bônus 4x4", which 26BR's table does not have,
    // over three rows of it.
    const mappings = buildTableMapping(['Projeto', 'Bônus 4x4']);
    const table = readBajaAppFixture(bajaAppFixtureFiles.overall26BR) as { rows: unknown[] };
    const threeRows = { ...table, rows: table.rows.slice(0, 3) };

    // Act: map it.
    const result = applyFlexMapping(mappings, { resultado: threeRows }, pollMomentMs);

    // Assert: one problem, naming the missing header.
    expect(result.ok ? [] : result.problems, 'a missing header must be named once').toEqual([
      'Pontuação: a tabela não tem a coluna "Bônus 4x4"',
    ]);
  });

  it('leaves out a part whose cell holds no value, keeping its column', () => {
    // Arrange: Poli Baja's row with its Enduro cell empty, as before the race is run.
    const mappings = buildTableMapping(partHeadersOf26BR);
    const table = readFirstRowOf26BR() as { rows: Array<{ cells: Array<{ raw: unknown }> }> };
    const enduroCell = table.rows[0]?.cells[8];
    if (enduroCell !== undefined) {
      enduroCell.raw = null;
    }

    // Act: map it.
    const result = applyFlexMapping(mappings, { resultado: table }, pollMomentMs);
    const standings = result.ok ? (result.shapes.standings as typeof poliBajaStandings) : undefined;

    // Assert: no Enduro points, but the Enduro part still listed.
    expect(
      standings?.entries[0]?.pointsByPart,
      'an empty cell must leave its part out of the team',
    ).not.toHaveProperty('Enduro');
    expect(standings?.scoreParts, 'the Enduro column must stay').toEqual(
      poliBajaStandings.scoreParts,
    );
  });

  it('names the team, the column and the value of a part that holds text', () => {
    // Arrange: Poli Baja's Projeto cell holding the word the API shows during spoilers.
    const mappings = buildTableMapping(partHeadersOf26BR);
    const table = readFirstRowOf26BR() as { rows: Array<{ cells: Array<{ raw: unknown }> }> };
    const projectCell = table.rows[0]?.cells[6];
    if (projectCell !== undefined) {
      projectCell.raw = 'SPOILERS';
    }

    // Act: map it.
    const result = applyFlexMapping(mappings, { resultado: table }, pollMomentMs);

    // Assert: one problem at that team's parts, naming the column and the value.
    expect(result.ok ? [] : result.problems, 'a text part must be refused').toEqual([
      'Pontuação › carro 5 (linha 1) › Partes da pontuação: a coluna "Projeto" não tem um número: "SPOILERS"',
    ]);
  });
});
