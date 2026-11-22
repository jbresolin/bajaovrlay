/**
 * The results table shape (packages/shared)
 *
 * What this module is for:
 *   A result page of the Baja app goes on air as the site shows it (BAJAOVRLAY-83): its own
 *   value columns, every cell as text ("SPOILERS", "SIM", "102.5%"), and the site's own
 *   rank, or none. This shape is what the results table graphic binds to.
 *
 * What these tests prove:
 *   - A page during spoilers, with no rank at all and "SPOILERS" in its cells, is valid.
 *   - A prova page with ranks and text cells is valid, in the order it comes.
 *   - A row with one cell too few or too many is refused, naming the row and the count:
 *     its cells would be drawn under the wrong heads.
 *   - A rank of 0 is refused: the site's ranks start at 1.
 *
 * What these tests deliberately do not cover:
 *   - How the cells are read from the Baja app's answer: resultsTableCellsFromColumns.test.ts
 *     and bajaAppResultsPagePreset.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from './validateDataShape.js';

/** Two rows of 25SU's overall page with spoilers on: no rank, Projeto and Total hidden. */
function buildOverallPageDuringSpoilers() {
  return {
    updatedAtMs: 1_763_740_800_000,
    tableName: 'Geral',
    columnHeads: ['Segurança', 'Projeto', 'Enduro', 'Total'],
    entries: [
      {
        carNumber: 1,
        teamName: 'Procobaja',
        schoolName: 'UTFPR-CP',
        cells: ['-15', 'SPOILERS', '84.71', 'SPOILERS'],
      },
      {
        carNumber: 2,
        teamName: 'Sagui',
        schoolName: 'UFPR',
        cells: ['0', 'SPOILERS', '91.3', 'SPOILERS'],
      },
    ],
  };
}

describe('ResultsTableShapeSchema', () => {
  it('accepts a page during spoilers, with no rank and hidden cells', () => {
    // Arrange: the overall page with spoilers on.
    const payload = buildOverallPageDuringSpoilers();

    // Act: validate it as a source's poll is validated.
    const validation = validateDataShape('resultsTable', payload);

    // Assert: valid, the cells kept as written.
    expect(validation.isValid, 'a page with spoilers must be valid').toBe(true);
    expect(validation.isValid ? validation.shape : undefined, 'nothing is changed').toEqual(
      payload,
    );
  });

  it('accepts a prova page with the site’s ranks and text cells', () => {
    // Arrange: two rows of a qualifying page, ranked by the site.
    const payload = {
      updatedAtMs: 1_763_740_800_000,
      columnHeads: ['Voltas', '% da média', 'Classificado (≤115%)', 'Larga em'],
      entries: [
        {
          rank: 1,
          carNumber: 7,
          teamName: 'Imperador',
          schoolName: 'UTFPR-CT',
          cells: ['51.9 / 52.3', '91.8%', 'SIM', '1º'],
        },
        {
          rank: 16,
          carNumber: 12,
          teamName: 'Pato',
          schoolName: 'UTFPR-PB',
          cells: ['66.4', '117.5%', 'NÃO', '-'],
        },
      ],
    };

    // Act: validate it.
    const validation = validateDataShape('resultsTable', payload);

    // Assert: valid.
    expect(validation.isValid, 'a prova page with text cells must be valid').toBe(true);
  });

  it('refuses a row with one cell too few, naming the row and the head count', () => {
    // Arrange: the spoilers page with Sagui's last cell gone.
    const payload = buildOverallPageDuringSpoilers();
    payload.entries[1]?.cells.pop();

    // Act: validate it.
    const validation = validateDataShape('resultsTable', payload);

    // Assert: refused at Sagui's cells, saying how many there must be.
    expect(validation, 'a short row must be refused').toEqual({
      isValid: false,
      errorMessage:
        'Dados inválidos em "resultsTable.entries.1.cells": cada linha tem uma célula por coluna da tabela, aqui 4.',
    });
  });

  it('refuses a rank of 0, since the site’s ranks start at 1', () => {
    // Arrange: the spoilers page with a rank 0 on Procobaja.
    const payload = buildOverallPageDuringSpoilers();
    const procobajaRowWithRankZero = { ...payload.entries[0], rank: 0 };
    payload.entries[0] = procobajaRowWithRankZero as (typeof payload.entries)[0];

    // Act: validate it.
    const validation = validateDataShape('resultsTable', payload);

    // Assert: refused at that rank.
    expect(validation.isValid, 'a rank of 0 must be refused').toBe(false);
    expect(
      validation.isValid ? '' : validation.errorMessage,
      'the message names the rank of the first row',
    ).toContain('resultsTable.entries.0.rank');
  });
});
