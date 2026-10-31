/**
 * The flex form's new options: of a request, of a value table, of a mapping block
 * (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-53 the flex form offers what the Baja app's results API needs, each
 *   generic: a request's "Atualizar a cada (s)"; a value table's "Senão"; and on a mapping
 *   block "Lista dentro de cada item", the lookups ("+ Consulta"), the table's layout,
 *   standings' "Partes da pontuação por coluna", "Recusar a resposta quando", the
 *   positions' "Calcular as diferenças pelas voltas" and the brackets' "Disputa incompleta
 *   quando". An option left empty is left out of the config.
 *
 * What these tests prove, one addition each (read back through "Exportar configuração"):
 *   - 600 s in "Atualizar a cada (s)" is refreshEveryMs 600 000; 30 s is refused under the
 *     field.
 *   - "Senão" turns the plain table into `{ table, otherwiseValue }`.
 *   - The list inside each item, a lookup, the table's layout, the parts by column, the
 *     refusal flag, the gaps switch and an incomplete-match condition are each built as
 *     typed; the refusal without a message is refused under "Mensagem da recusa".
 *   - The example preset, which uses none of them, still exports with none of their keys.
 *
 * What these tests deliberately do not cover:
 *   - What each option does to an answer: the shared applyFlexMapping*.test.ts files.
 *   - The readings of a field: DataSourcesPageFlexReadings.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { flipSwitch, pressButton } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildBajaAppOverallConfig,
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
import { readExampleTimingSystemConfig } from './timingSystemExample.testSupport';

/** Opens the new flex form with the example preset imported. */
function openTheFormWithTheExample(): void {
  renderPageWithSources();
  openTheNewFlexForm();
  importTheExamplePreset();
}

/** Opens the new flex form and imports a config into it. */
function openTheFormWithConfig(config: unknown): void {
  renderPageWithSources();
  openTheNewFlexForm();
  importConfigText(JSON.stringify(config, null, 2));
}

/** One part of the page found by its role and name. */
function findPart(role: 'region' | 'group', name: string) {
  return within(screen.getByRole(role, { name }));
}

/** Types into a field found by its label inside one part of the page. */
function typeIn(part: ReturnType<typeof within>, fieldLabel: string, text: string): void {
  fireEvent.change(part.getByLabelText(fieldLabel), { target: { value: text } });
}

describe('a request’s "Atualizar a cada (s)"', () => {
  it('builds refreshEveryMs 600 000 from 600 seconds', () => {
    // Arrange: the example preset imported.
    openTheFormWithTheExample();

    // Act: fetch its request every 10 minutes, then export.
    typeIn(findPart('region', 'Requisição 1'), 'Atualizar a cada (s)', '600');
    const config = exportTheConfig();

    // Assert: the request carries the time in ms.
    expect(config.requests[0]?.refreshEveryMs, 'the request must refresh every 10 min').toBe(
      600_000,
    );
  });

  it('refuses 30 seconds under the field', async () => {
    // Arrange: the example preset imported.
    openTheFormWithTheExample();
    const request = findPart('region', 'Requisição 1');

    // Act: type 30 s, under the shortest refresh time, and try to export.
    typeIn(request, 'Atualizar a cada (s)', '30');
    pressButton('Exportar configuração');

    // Assert: the shared sentence under the field.
    expect(
      await request.findByText(
        'O tempo de atualização da requisição vai de 1 minuto (60000 ms) a 1 hora (3600000 ms), em milissegundos inteiros.',
      ),
      'a refresh under a minute must be refused under its field',
    ).toBeInTheDocument();
  });
});

describe('a value table’s "Senão"', () => {
  it('builds the table with an otherwise value', () => {
    // Arrange: the example preset, whose status is read with a value table.
    openTheFormWithTheExample();
    const positions = findPart('region', 'Mapeamento: Posições');

    // Act: any code the table does not list becomes "running", then export.
    typeIn(positions, 'Senão, Situação vira', 'running');
    const config = exportTheConfig();

    // Assert: the table moves under "table", beside the otherwise value.
    const statusRule = findRuleOfTarget(findMappingOfShape(config, 'positions'), 'status');
    const exampleStatusRule = findRuleOfTarget(
      findMappingOfShape(readExampleTimingSystemConfig(), 'positions'),
      'status',
    );
    expect(statusRule?.transformParameters, 'the table must carry its otherwise value').toEqual({
      table: exampleStatusRule?.transformParameters,
      otherwiseValue: 'running',
    });
  });
});

describe('the options of a mapping block', () => {
  it('builds "Lista dentro de cada item"', () => {
    // Arrange: the example preset imported.
    openTheFormWithTheExample();

    // Act: read the cars inside each element of the list, then export.
    typeIn(findPart('region', 'Mapeamento: Posições'), 'Lista dentro de cada item', 'carros');
    const config = exportTheConfig();

    // Assert: the positions mapping names the inner list.
    expect(
      findMappingOfShape(config, 'positions').nestedEntriesPath,
      'the inner list must be named',
    ).toBe('carros');
  });

  it('builds a lookup added with "+ Consulta"', () => {
    // Arrange: the example preset imported.
    openTheFormWithTheExample();
    const positions = findPart('region', 'Mapeamento: Posições');

    // Act: join the teams listed under "equipes" by their number, then export.
    pressButton('+ Consulta');
    const lookup = findPart('region', 'Consulta 1');
    typeIn(lookup, 'Nome da consulta', 'equipes');
    typeIn(lookup, 'Caminho da lista', 'equipes');
    typeIn(lookup, 'Chave em cada item da lista', 'numero');
    typeIn(lookup, 'Chave em cada item deste formato', 'carro');
    chooseOptionIn(positions, 'Requisição da lista', 'classificacao');
    const config = exportTheConfig();

    // Assert: the lookup as typed.
    expect(findMappingOfShape(config, 'positions').lookups, 'the lookup must be built').toEqual([
      {
        lookupName: 'equipes',
        requestId: 'classificacao',
        listPath: 'equipes',
        keyPath: 'numero',
        entryKeyPath: 'carro',
      },
    ]);
  });

  it('builds the table’s layout', () => {
    // Arrange: the example preset imported.
    openTheFormWithTheExample();
    const table = findPart('group', 'Tabela de colunas (ler células pelo cabeçalho)');

    // Act: say where the columns, their headers and each row's cells are, then export.
    typeIn(table, 'Caminho das colunas', 'columns');
    typeIn(table, 'Cabeçalho em cada coluna', 'header');
    typeIn(table, 'Células em cada item', 'cells');
    const config = exportTheConfig();

    // Assert: the layout as typed.
    expect(findMappingOfShape(config, 'positions').table, 'the layout must be built').toEqual({
      columnsPath: 'columns',
      headerPath: 'header',
      cellsPath: 'cells',
    });
  });

  it('builds the standings’ parts from the headers picked, one per line', () => {
    // Arrange: the overall config imported.
    openTheFormWithConfig(buildBajaAppOverallConfig());
    const parts = findPart('group', 'Partes da pontuação por coluna');

    // Act: keep two parts only, then export.
    typeIn(parts, 'Cabeçalhos das partes (um por linha)', 'Projeto\nEnduro\n');
    const config = exportTheConfig();

    // Assert: the two headers, in order, with the value's path.
    expect(
      findMappingOfShape(config, 'standings').scorePartsFromColumns,
      'the parts must be the headers picked',
    ).toEqual({ headers: ['Projeto', 'Enduro'], valuePath: 'raw' });
  });

  it('builds "Recusar a resposta quando" with its typed value', () => {
    // Arrange: the example preset imported.
    openTheFormWithTheExample();
    const refusal = within(
      findPart('region', 'Mapeamento: Sessão').getByRole('group', {
        name: 'Recusar a resposta quando',
      }),
    );

    // Act: refuse a simulated race, then export.
    typeIn(refusal, 'Caminho da recusa', 'prova.simulada');
    typeIn(refusal, 'Valor que recusa', 'true');
    typeIn(refusal, 'Mensagem da recusa', 'Corrida simulada: não vai ao ar.');
    const config = exportTheConfig();

    // Assert: the flag, its value read as the boolean true.
    expect(findMappingOfShape(config, 'session').refuseWhen, 'the refusal must be built').toEqual({
      path: 'prova.simulada',
      equals: true,
      message: 'Corrida simulada: não vai ao ar.',
    });
  });

  it('refuses a refusal with no message, under "Mensagem da recusa"', async () => {
    // Arrange: the example preset with a refusal path and value but no message.
    openTheFormWithTheExample();
    const session = findPart('region', 'Mapeamento: Sessão');
    typeIn(session, 'Caminho da recusa', 'prova.simulada');
    typeIn(session, 'Valor que recusa', 'true');

    // Act: try to export.
    pressButton('Exportar configuração');

    // Assert: the shared sentence under the message.
    expect(
      await session.findByText('A recusa precisa de uma mensagem para o operador.'),
      'a refusal needs its message',
    ).toBeInTheDocument();
  });

  it('builds "Calcular as diferenças pelas voltas" from the switch', () => {
    // Arrange: the example preset imported.
    openTheFormWithTheExample();

    // Act: flip the switch, then export.
    flipSwitch('Calcular as diferenças pelas voltas');
    const config = exportTheConfig();

    // Assert: the positions mapping works out its gaps.
    expect(
      findMappingOfShape(config, 'positions').workOutGapsFromLaps,
      'the gaps must be worked out',
    ).toBe(true);
  });

  it('builds "Disputa incompleta quando" from its comma-separated values', () => {
    // Arrange: the tournament config imported, its first condition on slot 1's type.
    openTheFormWithConfig(buildBajaAppTournamentConfig());
    const firstCondition = findPart('group', 'Condição 1');

    // Act: mark incomplete only a pending side, then export.
    typeIn(firstCondition, 'Valores da condição 1 (separados por vírgula)', 'pending');
    const config = exportTheConfig();

    // Assert: the first condition lists one value; the second is unchanged.
    expect(
      findMappingOfShape(config, 'brackets').entryIsIncompleteWhen,
      'the conditions must be built as typed',
    ).toEqual([
      { path: 'slots[0].type', isOneOf: ['pending'] },
      { path: 'slots[1].type', isOneOf: ['pending', 'unknown'] },
    ]);
  });

  it('adds none of the new keys to the example preset, which uses no option', () => {
    // Arrange: the example preset imported.
    openTheFormWithTheExample();

    // Act: export it untouched.
    const config = exportTheConfig();

    // Assert: the very preset, with no option key on any mapping or request.
    expect(config, 'options left empty must add no key').toEqual(readExampleTimingSystemConfig());
  });
});
