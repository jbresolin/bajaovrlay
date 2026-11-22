/**
 * The results page preset against the Baja app's result pages (packages/shared)
 *
 * What this module is for:
 *   "Tabela de resultado" (BAJAOVRLAY-83) puts any result page (resultado.php) on air as
 *   the site shows it. Its preset, resultado-tabela.preset.json, maps a page into the
 *   results table shape: the page's value columns, every cell as text, the site's own rank
 *   and the names joined from the event's teams. Unlike the standings preset it reads a
 *   page during spoilers too, unless the operator asks for the refusal.
 *
 * What these tests prove:
 *   - The doc's 25SU overall page with spoilers on maps and validates: no rank, the rank,
 *     car and team columns left out, "SPOILERS" kept, the empty cell as "", the short
 *     names from the teams.
 *   - With the refusal asked for, the same page is refused with the spoilers sentence.
 *   - The made-up 25SU qualifying page keeps its order and ranks, and writes its cells as
 *     the site does ("51.9 / 52.3", "91.8%", "SIM", "1º", "-").
 *   - A real page that ranks nobody (26BR's static safety) maps too, every rank left out,
 *     and a real answer with only `raw` cells is written from `raw`.
 *
 * What these tests deliberately do not cover:
 *   - Each cell's text one by one: resultsTableCellsFromColumns.test.ts.
 *   - The graphic that draws the table: packages/graphics/results-table.
 */
import { describe, expect, it } from 'vitest';

import type { ResultsTableShape } from '../../../dataShapes/resultsTableShape.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from '../../bajaAppFixtures.testSupport.js';
import { mapAndValidate } from './bajaAppPresetMapping.testSupport.js';
import {
  bajaAppApiAddress,
  buildBajaAppResultsPageSourceConfig,
  spoilersRefusalMessage,
} from './bajaAppPresets.js';

/** The results page preset on one result of an event, the refusal off unless asked. */
function buildResultsPageConfig(eventId: string, resultadoId: string, refuses = false) {
  return buildBajaAppResultsPageSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId,
    resultadoId,
    refusesDuringSpoilers: refuses,
  });
}

/** Maps one result page with the event's teams; answers the results table or the problems. */
function mapResultsPage(
  config: ReturnType<typeof buildResultsPageConfig>,
  pageFile: string,
  teamsFile: string,
) {
  const outcome = mapAndValidate(config, {
    resultado: readBajaAppFixture(pageFile),
    equipes: readBajaAppFixture(teamsFile),
  });
  return {
    problems: outcome.problems,
    resultsTable: outcome.shapes?.resultsTable as ResultsTableShape | undefined,
  };
}

describe('the results page preset', () => {
  it('maps the overall page during spoilers, with no rank and the hidden cells as written', () => {
    // Arrange: the preset on 25SU's overall page, the refusal off (the default).
    const config = buildResultsPageConfig('25SU', '25SU_GER');

    // Act: map the doc's spoilers answer with 25SU's teams.
    const { problems, resultsTable } = mapResultsPage(
      config,
      bajaAppFixtureFiles.overallDuringSpoilers25SU,
      bajaAppFixtureFiles.teams25SU,
    );

    // Assert: no problem, the value columns only, and Procobaja's row as the site shows it.
    expect(problems, 'a page with spoilers must map without a problem').toEqual([]);
    expect(resultsTable?.tableName, 'the page’s own name').toBe('Geral');
    expect(resultsTable?.columnHeads, 'the value columns, Pos, # and Equipe left out').toEqual([
      'Segurança',
      'Projeto',
      'Dinâmicas',
      'Enduro',
      'Bônus 4x4',
      'Penalizações',
      'Total',
    ]);
    expect(resultsTable?.entries, 'Procobaja, unranked, its hidden cells kept').toEqual([
      {
        carNumber: 1,
        teamName: 'Procobaja',
        schoolName: 'UTFPR-CP',
        cells: ['-15', 'SPOILERS', 'SPOILERS', '84.71', '0', '', 'SPOILERS'],
      },
    ]);
  });

  it('refuses the page during spoilers when the operator asks for the refusal', () => {
    // Arrange: the preset with "Recusar durante spoilers".
    const config = buildResultsPageConfig('25SU', '25SU_GER', true);

    // Act: map the same spoilers answer.
    const { problems, resultsTable } = mapResultsPage(
      config,
      bajaAppFixtureFiles.overallDuringSpoilers25SU,
      bajaAppFixtureFiles.teams25SU,
    );

    // Assert: refused with the standings preset's own sentence, nothing mapped.
    expect(problems, 'the spoilers sentence alone').toEqual([spoilersRefusalMessage]);
    expect(resultsTable, 'no table when refused').toBeUndefined();
  });

  it('keeps a prova page’s order and ranks, its cells as the site writes them', () => {
    // Arrange: the preset on 25SU's (made-up) qualifying page.
    const config = buildResultsPageConfig('25SU', '25SU_CLE');

    // Act: map it with 25SU's teams.
    const { problems, resultsTable } = mapResultsPage(
      config,
      bajaAppFixtureFiles.enduroQualifyingPage25SU,
      bajaAppFixtureFiles.teams25SU,
    );

    // Assert: the six value columns, sixteen rows ranked 1 to 16 in order, first and last.
    expect(problems, 'the qualifying page must map without a problem').toEqual([]);
    expect(resultsTable?.columnHeads, 'the page’s six value columns').toEqual([
      'Voltas',
      'Melhor volta',
      '% da média',
      'Classificado (≤115%)',
      'Larga em',
      'Pontos',
    ]);
    const ranksInOrder = resultsTable?.entries.map((entry) => entry.rank);
    expect(ranksInOrder, 'the site’s ranks, in the order they came').toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    expect(resultsTable?.entries[0], 'Imperador first, as the site shows it').toEqual({
      rank: 1,
      carNumber: 7,
      teamName: 'Imperador',
      schoolName: 'UTFPR-CT',
      cells: ['51.9 / 52.3', '51.9', '91.8%', 'SIM', '1º', '100'],
    });
    expect(resultsTable?.entries[15]?.cells, 'Pato out of the 115%, starting nowhere').toEqual([
      '66.4',
      '66.4',
      '117.5%',
      'NÃO',
      '-',
      '0',
    ]);
  });

  it('maps a real page that ranks nobody, its raw cells written as text', () => {
    // Arrange: the preset on 26BR's static safety page (no position, cells with raw only).
    const config = buildResultsPageConfig('26BR', '26BR_SGE');

    // Act: map it with 26BR's teams.
    const { problems, resultsTable } = mapResultsPage(
      config,
      bajaAppFixtureFiles.staticSafetyTableRankingNobody26BR,
      bajaAppFixtureFiles.teams26BR,
    );

    // Assert: mapped, no rank anywhere, and UFMG's "SIM" and "APROVADO" read from raw.
    expect(problems, 'a page that ranks nobody must still map').toEqual([]);
    const ranksGiven = resultsTable?.entries.filter((entry) => entry.rank !== undefined);
    expect(ranksGiven, 'no row has a rank').toEqual([]);
    expect(resultsTable?.entries[0]?.cells.slice(-2), 'the last two cells of car 1').toEqual([
      'SIM',
      'APROVADO',
    ]);
  });
});
