/**
 * The flex form's "Importar configuração" and "Exportar configuração" (apps/control)
 *
 * What this module is for:
 *   A tested flex config travels as JSON text. "Importar configuração" takes pasted JSON,
 *   checks it with the shared config schema and fills the requests and mappings;
 *   "Exportar configuração" shows the form's config as JSON to copy. This is how a preset
 *   file (the Baja app's, BAJAOVRLAY-18) becomes a source.
 *
 * What these tests prove:
 *   - Importing the example preset fills the request's address, the positions block and
 *     its rows, and keeps the name already typed.
 *   - Broken JSON, and a config the schema refuses, say why and leave the form as it was.
 *   - Exporting right after importing gives back the very config imported, its rules in
 *     the order they were written even when that is not the order of the form's rows.
 *
 * What these tests deliberately do not cover:
 *   - Every refusal of the schema: packages/shared/src/dataSources/httpJsonConfig.test.ts.
 *   - Reading the text itself: flexConfigImportAndExport.test.ts.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { pressButton, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  importConfigText,
  importTheExamplePreset,
  openTheNewFlexForm,
  renderPageWithSources,
} from './flexFormOnThePage.testSupport';
import {
  readExampleTimingSystemConfig,
  readExampleTimingSystemConfigText,
  readExampleTimingSystemConfigWithRulesReversed,
} from './timingSystemExample.testSupport';

describe('"Importar configuração"', () => {
  it('fills the requests and mappings from the example preset, keeping the name typed', () => {
    // Arrange: the new flex form with its name typed.
    renderPageWithSources();
    openTheNewFlexForm();
    typeIntoField('Nome da fonte', 'Cronometragem da pista');

    // Act: import the example preset.
    importTheExamplePreset();

    // Assert: the address, a positions block whose team row reads "equipe", the name kept.
    const firstRequest = within(screen.getByRole('region', { name: 'Requisição 1' }));
    expect(
      firstRequest.getByLabelText('Endereço (URL)'),
      "the request's address must come from the preset",
    ).toHaveValue('http://localhost:4790/cronometragem/classificacao');
    const positions = within(screen.getByRole('region', { name: 'Mapeamento: Posições' }));
    expect(
      positions.getByRole('textbox', { name: 'Caminho de Equipe' }),
      "the team's row must read the preset's path",
    ).toHaveValue('equipe');
    expect(
      screen.getByRole('region', { name: 'Mapeamento: Sessão' }),
      'the session block must be there too',
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome da fonte'), 'an import must not touch the name').toHaveValue(
      'Cronometragem da pista',
    );
  });

  it('says why broken JSON is refused and leaves the form as it was', () => {
    // Arrange: the new flex form, its one request still empty.
    renderPageWithSources();
    openTheNewFlexForm();

    // Act: paste a config copied only halfway.
    importConfigText(readExampleTimingSystemConfigText().slice(0, 120));

    // Assert: the reason shown, the request still empty, no mapping block.
    expect(screen.getByRole('alert'), 'the import must say what is wrong').toHaveTextContent(
      'O texto colado não é JSON válido.',
    );
    expect(
      screen.getByLabelText('Endereço (URL)'),
      'a refused import must change nothing',
    ).toHaveValue('');
    expect(
      screen.queryByRole('region', { name: 'Mapeamento: Posições' }),
      'a refused import must add no mapping',
    ).not.toBeInTheDocument();
  });

  it('lists what the schema refuses, with the place of each problem', () => {
    // Arrange: the example preset with its request on an ftp:// address.
    renderPageWithSources();
    openTheNewFlexForm();
    const config = readExampleTimingSystemConfig();
    const configWithFtp = {
      ...config,
      requests: [{ ...config.requests[0], url: 'ftp://cronometragem.local/classificacao' }],
    };

    // Act: import it.
    importConfigText(JSON.stringify(configWithFtp));

    // Assert: the problem with its place, and nothing filled.
    expect(screen.getByRole('alert'), 'the refusal must name the field and why').toHaveTextContent(
      'requests.0.url: O endereço "ftp://cronometragem.local/classificacao" precisa começar com http:// ou https://.',
    );
    expect(
      screen.queryByRole('region', { name: 'Mapeamento: Posições' }),
      'a refused import must add no mapping',
    ).not.toBeInTheDocument();
  });
});

describe('"Exportar configuração"', () => {
  it('gives back the very config just imported', () => {
    // Arrange: the new flex form with the example preset imported.
    renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();

    // Act: export it.
    pressButton('Exportar configuração');

    // Assert: the box holds the preset, as the server would store it.
    const exportedText = (
      screen.getByLabelText('Configuração (JSON para copiar)') as HTMLTextAreaElement
    ).value;
    expect(JSON.parse(exportedText), 'an export must round-trip the import exactly').toEqual(
      readExampleTimingSystemConfig(),
    );
  });

  it('gives back the rules in the order they were imported, not in the order of the rows', () => {
    // Arrange: the new flex form with a preset whose rules are listed last to first.
    renderPageWithSources();
    openTheNewFlexForm();
    importConfigText(JSON.stringify(readExampleTimingSystemConfigWithRulesReversed(), null, 2));

    // Act: export it.
    pressButton('Exportar configuração');

    // Assert: the same config, its rules still last to first.
    const exportedText = (
      screen.getByLabelText('Configuração (JSON para copiar)') as HTMLTextAreaElement
    ).value;
    expect(JSON.parse(exportedText), "an export must keep the imported rules' order").toEqual(
      readExampleTimingSystemConfigWithRulesReversed(),
    );
  });

  it('asks for the marked fields to be fixed when the form is not a valid config', async () => {
    // Arrange: the new flex form, its request without a name or an address.
    renderPageWithSources();
    openTheNewFlexForm();

    // Act: export it.
    pressButton('Exportar configuração');

    // Assert: no JSON box; the reason, and the address marked.
    expect(
      screen.getByRole('alert'),
      'the export must say why it cannot show JSON',
    ).toHaveTextContent('Corrija os campos marcados antes de exportar.');
    expect(
      screen.queryByLabelText('Configuração (JSON para copiar)'),
      'an invalid form must not be exported',
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText('O endereço "" precisa começar com http:// ou https://.'),
      'the empty address must be marked with its problem',
    ).toBeInTheDocument();
  });
});
