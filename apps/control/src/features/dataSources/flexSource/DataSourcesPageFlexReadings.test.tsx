/**
 * The flex form's new readings of a field (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-53 a field's row offers, beside "Caminho", "Valor fixo", "Ordem na
 *   lista" and "Momento da leitura": "Item de fora" (the outer element of a nested list),
 *   "Consulta" (a list of another request joined by key), "Coluna" (a table cell by its
 *   header) and "Alternativas" (readings tried in order, the first not empty winning).
 *   The operator picks one and fills its controls; the form builds the rule the shared
 *   schema checks, and puts each refusal under the control it is about.
 *
 * What these tests prove:
 *   - Each reading of an imported config shows in its row: the round name from the outer
 *     element, the points from the "Total" column.
 *   - Picking "Item de fora", "Consulta", "Coluna" or "Alternativas" and filling it builds
 *     that rule (read back through "Exportar configuração").
 *   - A refusal lands under its control: alternatives with one source under the row, a
 *     fixed value before the last alternative under that alternative, a lookup the mapping
 *     no longer declares under "Consulta de …".
 *
 * What these tests deliberately do not cover:
 *   - What each reading does to an answer: the shared applyFlexMapping*.test.ts files.
 *   - The mapping block's options (lookups, table, refusal…):
 *     DataSourcesPageFlexMappingOptions.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { pressButton } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildBajaAppOverallConfig,
  buildBajaAppRaceConfig,
  buildBajaAppTournamentConfig,
} from './bajaAppExamples.testSupport';
import {
  chooseOptionIn,
  exportTheConfig,
  findMappingOfShape,
  findRuleOfTarget,
  importConfigText,
  importTheExamplePreset,
  openTheNewFlexForm,
  renderPageWithSources,
} from './flexFormOnThePage.testSupport';

/** Opens the new flex form and imports a config into it. */
function openTheFormWithConfig(config: unknown): void {
  renderPageWithSources();
  openTheNewFlexForm();
  importConfigText(JSON.stringify(config, null, 2));
}

/** One mapping block of the form, by its shape's name. */
function findMappingBlock(shapeName: string) {
  return within(screen.getByRole('region', { name: `Mapeamento: ${shapeName}` }));
}

/** Types into a text box found by its name inside one part of the page. */
function typeIn(part: ReturnType<typeof within>, textBoxName: string, text: string): void {
  fireEvent.change(part.getByRole('textbox', { name: textBoxName }), { target: { value: text } });
}

describe('the readings of an imported config, in their rows', () => {
  it('shows the round name read from the outer element of the tournament', () => {
    // Arrange: the new flex form.

    // Act: import the tournament config, whose round name is "Item de fora" → "name".
    openTheFormWithConfig(buildBajaAppTournamentConfig());

    // Assert: the row shows the kind and the path.
    const brackets = findMappingBlock('Chaves');
    expect(
      brackets.getByRole('combobox', { name: 'Origem de Fase' }),
      'the round name must be read from the outer element',
    ).toHaveTextContent('Item de fora');
    expect(
      brackets.getByRole('textbox', { name: 'Caminho no item de fora de Fase' }),
      'the path on the round must be "name"',
    ).toHaveValue('name');
  });

  it('shows the points read from the "Total" column of the results table', () => {
    // Arrange: the new flex form.

    // Act: import the overall config, whose points come from the column "Total" → "raw".
    openTheFormWithConfig(buildBajaAppOverallConfig());

    // Assert: the row shows the column's header and the path in its cell.
    const standings = findMappingBlock('Pontuação');
    expect(
      standings.getByRole('textbox', { name: 'Coluna de Pontos' }),
      'the points must come from the "Total" column',
    ).toHaveValue('Total');
    expect(
      standings.getByRole('textbox', { name: 'Caminho na célula de Pontos' }),
      'the value inside the cell must be "raw"',
    ).toHaveValue('raw');
  });
});

describe('picking a reading builds its rule', () => {
  it('builds "Item de fora" for the best of N, read from the round', () => {
    // Arrange: the tournament config imported.
    openTheFormWithConfig(buildBajaAppTournamentConfig());
    const brackets = findMappingBlock('Chaves');

    // Act: read "Melhor de N" from the round's "best_of", then export.
    chooseOptionIn(brackets, 'Origem de Melhor de N', 'Item de fora');
    typeIn(brackets, 'Caminho no item de fora de Melhor de N', 'best_of');
    const config = exportTheConfig();

    // Assert: the rule reads the outer element.
    expect(
      findRuleOfTarget(findMappingOfShape(config, 'brackets'), 'bestOf'),
      'the rule must read the outer element',
    ).toEqual({ targetField: 'bestOf', fromParent: 'best_of' });
  });

  it('builds "Consulta" for the team name, read from the teams list', () => {
    // Arrange: the race config imported, its teams lookup named "equipes".
    openTheFormWithConfig(buildBajaAppRaceConfig());
    const positions = findMappingBlock('Posições');

    // Act: read "Equipe" from the matched team's full name, then export.
    chooseOptionIn(positions, 'Origem de Equipe', 'Consulta');
    chooseOptionIn(positions, 'Consulta de Equipe', 'equipes');
    typeIn(positions, 'Caminho na consulta de Equipe', 'name');
    const config = exportTheConfig();

    // Assert: the rule reads the lookup.
    expect(
      findRuleOfTarget(findMappingOfShape(config, 'positions'), 'teamName'),
      'the rule must read the lookup',
    ).toEqual({ targetField: 'teamName', fromLookup: { lookup: 'equipes', path: 'name' } });
  });

  it('builds "Coluna" for the rank, read from the "Pos" column', () => {
    // Arrange: the overall config imported.
    openTheFormWithConfig(buildBajaAppOverallConfig());
    const standings = findMappingBlock('Pontuação');

    // Act: read "Classificação" from the "Pos" column's raw value, then export.
    chooseOptionIn(standings, 'Origem de Classificação', 'Coluna');
    typeIn(standings, 'Coluna de Classificação', 'Pos');
    typeIn(standings, 'Caminho na célula de Classificação', 'raw');
    const config = exportTheConfig();

    // Assert: the rule reads the column.
    expect(
      findRuleOfTarget(findMappingOfShape(config, 'standings'), 'rank'),
      'the rule must read the column',
    ).toEqual({ targetField: 'rank', fromColumn: { header: 'Pos', path: 'raw' } });
  });

  it('builds "Alternativas" for the team name: the short name, else the full name', () => {
    // Arrange: the example preset imported.
    renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();
    const positions = findMappingBlock('Posições');

    // Act: two alternatives, "equipe_curta" then "equipe", then export.
    chooseOptionIn(positions, 'Origem de Equipe', 'Alternativas');
    pressButton('+ Alternativa');
    pressButton('+ Alternativa');
    typeIn(positions, 'Caminho da Alternativa 1 de Equipe', 'equipe_curta');
    typeIn(positions, 'Caminho da Alternativa 2 de Equipe', 'equipe');
    const config = exportTheConfig();

    // Assert: the rule tries the two paths in order, keeping its transform.
    expect(
      findRuleOfTarget(findMappingOfShape(config, 'positions'), 'teamName'),
      'the rule must list the alternatives in order',
    ).toEqual({
      targetField: 'teamName',
      firstOf: [{ fromPath: 'equipe_curta' }, { fromPath: 'equipe' }],
      transformId: 'trimText',
    });
  });
});

describe('a refused reading, under its control', () => {
  it('says under the row that alternatives need two sources', async () => {
    // Arrange: the example preset with "Equipe" made "Alternativas" with one alternative.
    renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();
    const positions = findMappingBlock('Posições');
    chooseOptionIn(positions, 'Origem de Equipe', 'Alternativas');
    pressButton('+ Alternativa');
    typeIn(positions, 'Caminho da Alternativa 1 de Equipe', 'equipe');

    // Act: try to export.
    pressButton('Exportar configuração');

    // Assert: the shared sentence shows in the row.
    expect(
      await positions.findByText(
        'As alternativas da regra de "teamName" precisam de pelo menos duas origens; com uma só, use a origem direto.',
      ),
      'a single alternative must be refused in its row',
    ).toBeInTheDocument();
  });

  it('marks the alternative whose fixed value is not the last one', async () => {
    // Arrange: the race config, the clock's alternatives swapped: the fixed 0 first.
    openTheFormWithConfig(buildBajaAppRaceConfig());
    const session = findMappingBlock('Sessão');
    chooseOptionIn(
      session,
      'Origem da Alternativa 1 de Relógio › Tempo de referência',
      'Valor fixo',
    );
    typeIn(session, 'Valor fixo da Alternativa 1 de Relógio › Tempo de referência', '0');

    // Act: try to export.
    pressButton('Exportar configuração');

    // Assert: the box of the first alternative is marked with the shared sentence.
    expect(
      await session.findByText(
        'Na regra de "clock.referenceTimeMs", o valor fixo só pode ser a última alternativa: as que viessem depois nunca seriam usadas.',
      ),
      'the fixed value out of place must be refused',
    ).toBeInTheDocument();
    expect(
      session.getByRole('textbox', {
        name: 'Valor fixo da Alternativa 1 de Relógio › Tempo de referência',
      }),
      'the first alternative must be the one marked',
    ).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks "Consulta" when the lookup it reads was renamed', async () => {
    // Arrange: the race config with its teams lookup renamed "times".
    openTheFormWithConfig(buildBajaAppRaceConfig());
    const positions = findMappingBlock('Posições');
    typeIn(positions, 'Nome da consulta', 'times');

    // Act: try to export.
    pressButton('Exportar configuração');

    // Assert: the shared sentence names the lookup that no longer exists.
    expect(
      (await positions.findAllByText('A consulta "equipes" não existe neste mapeamento.')).length,
      'the rules still reading "equipes" must be refused',
    ).toBeGreaterThan(0);
  });
});
