/**
 * The "Fontes de dados" page: making and changing a flex HTTP/JSON source (apps/control)
 *
 * What this module is for:
 *   "+ Fonte" offers a third kind, "HTTP/JSON (flexível)", whose form is written by hand:
 *   the requests (name, address, headers and query parameters) and one mapping block per
 *   shape with a row per canonical field. "Salvar fonte" checks it with the shared config
 *   schema and sends createDataSource; "Editar" on a stored flex source opens the same
 *   form filled in and sends only what changed.
 *
 * What these tests prove:
 *   - The example preset imported and named is sent as createDataSource, its config whole.
 *   - A positions block filled by hand (list order, a transform, a value table) is sent
 *     with exactly those rules.
 *   - A header variable without the BAJAOVRLAY_SOURCE_ prefix is refused under its row
 *     and nothing is sent.
 *   - "Editar" on a flex source sends updateDataSource with only the new name, its
 *     unchanged config (lists in lists) not counting as a change.
 *
 * What these tests deliberately do not cover:
 *   - Every placement of a refusal: flexSourceFormReading.test.ts.
 *   - Import and export, and "Testar": DataSourcesPageFlexImportExport.test.tsx and
 *     DataSourcesPageFlexTest.test.tsx.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { pressButton, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { letThePageFinishWhatItStarted } from '@/state/controlPageOnFakeServer.testSupport';

import {
  chooseOptionIn,
  importTheExamplePreset,
  openTheNewFlexForm,
  renderPageWithSources,
} from './flexFormOnThePage.testSupport';
import {
  buildTimingSystemSourceThatIsOff,
  readExampleTimingSystemConfig,
} from './timingSystemExample.testSupport';

describe('a new flex source', () => {
  it('is sent as createDataSource with the example preset imported and a name', async () => {
    // Arrange: the new flex form, named, with the example preset imported.
    const { fakeServer } = renderPageWithSources();
    openTheNewFlexForm();
    typeIntoField('Nome da fonte', 'Cronometragem da pista');
    importTheExamplePreset();

    // Act: press "Salvar fonte".
    pressButton('Salvar fonte');

    // Assert: the whole source, its config the preset exactly.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the flex source must be sent whole').toEqual([
        {
          type: 'createDataSource',
          label: 'Cronometragem da pista',
          kind: 'httpJson',
          config: readExampleTimingSystemConfig(),
          pollIntervalMs: 2_000,
        },
      ]);
    });
  });

  it('is sent with the rules of a positions block filled by hand', async () => {
    // Arrange: a request "classificacao" on the timing system, and a positions block:
    // place by list order, car number as text, status from a table where BOX is the pit.
    const { fakeServer } = renderPageWithSources();
    openTheNewFlexForm();
    typeIntoField('Nome da fonte', 'Cronometragem da pista');
    const firstRequest = within(screen.getByRole('region', { name: 'Requisição 1' }));
    fireEvent.change(firstRequest.getByLabelText('Nome da requisição'), {
      target: { value: 'classificacao' },
    });
    fireEvent.change(firstRequest.getByLabelText('Endereço (URL)'), {
      target: { value: 'http://192.168.0.20:8080/classificacao' },
    });
    pressButton('+ Posições');
    const positions = within(screen.getByRole('region', { name: 'Mapeamento: Posições' }));
    fireEvent.change(positions.getByLabelText('Caminho da lista'), {
      target: { value: 'classificacao' },
    });
    chooseOptionIn(positions, 'Origem de Momento da atualização', 'Momento da leitura');
    chooseOptionIn(positions, 'Origem de Posição', 'Ordem na lista');
    chooseOptionIn(positions, 'Origem de Carro', 'Caminho');
    fireEvent.change(positions.getByRole('textbox', { name: 'Caminho de Carro' }), {
      target: { value: 'carro' },
    });
    chooseOptionIn(positions, 'Transformação de Carro', 'Texto para número inteiro');
    chooseOptionIn(positions, 'Origem de Situação', 'Caminho');
    fireEvent.change(positions.getByRole('textbox', { name: 'Caminho de Situação' }), {
      target: { value: 'situacao' },
    });
    chooseOptionIn(positions, 'Transformação de Situação', 'Tabela de valores');
    const statusTable = within(
      positions.getByRole('group', { name: 'Tabela de valores de Situação' }),
    );
    fireEvent.click(statusTable.getByRole('button', { name: '+ Linha' }));
    fireEvent.change(statusTable.getByRole('textbox', { name: 'Valor da fonte 1' }), {
      target: { value: 'BOX' },
    });
    fireEvent.change(statusTable.getByRole('textbox', { name: 'Vira 1' }), {
      target: { value: 'inPit' },
    });

    // Act: press "Salvar fonte".
    pressButton('Salvar fonte');

    // Assert: the request and exactly the rules filled in, in the rows' order.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the rules shown must be the rules sent').toEqual([
        {
          type: 'createDataSource',
          label: 'Cronometragem da pista',
          kind: 'httpJson',
          config: {
            requests: [
              {
                requestId: 'classificacao',
                url: 'http://192.168.0.20:8080/classificacao',
                headers: [],
                queryParameters: [],
              },
            ],
            mappings: [
              {
                shapeKey: 'positions',
                requestId: 'classificacao',
                entriesPath: 'classificacao',
                fields: [{ targetField: 'updatedAtMs', fromPollMoment: true }],
                entryFields: [
                  { targetField: 'position', fromListOrder: true },
                  { targetField: 'carNumber', fromPath: 'carro', transformId: 'textToInteger' },
                  {
                    targetField: 'status',
                    fromPath: 'situacao',
                    transformId: 'mapValues',
                    transformParameters: { BOX: 'inPit' },
                  },
                ],
              },
            ],
          },
          pollIntervalMs: 2_000,
        },
      ]);
    });
  });

  it('is not sent while a header reads a variable without the BAJAOVRLAY_SOURCE_ prefix', async () => {
    // Arrange: the example preset with an Authorization header read from DATABASE_PATH.
    const { fakeServer } = renderPageWithSources();
    openTheNewFlexForm();
    typeIntoField('Nome da fonte', 'Cronometragem da pista');
    importTheExamplePreset();
    const headers = within(screen.getByRole('group', { name: 'Cabeçalhos' }));
    fireEvent.click(headers.getByRole('button', { name: '+ Cabeçalho' }));
    fireEvent.change(headers.getByRole('textbox', { name: 'Nome 1' }), {
      target: { value: 'Authorization' },
    });
    chooseOptionIn(headers, 'Tipo do valor 1', 'Variável de ambiente');
    fireEvent.change(headers.getByRole('textbox', { name: 'Variável 1' }), {
      target: { value: 'DATABASE_PATH' },
    });

    // Act: press "Salvar fonte" and give the page its moment.
    pressButton('Salvar fonte');
    await letThePageFinishWhatItStarted();

    // Assert: the refusal under the header, nothing sent.
    expect(
      await headers.findByText(/"DATABASE_PATH" não pode ser usada/),
      'the header must say why its variable is refused',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'a refused form must send nothing').toEqual([]);
  });
});

describe('"Editar" on a flex source', () => {
  it('sends updateDataSource with only the new name', async () => {
    // Arrange: the stored flex source's form opened with "Editar", renamed.
    const { fakeServer } = renderPageWithSources([buildTimingSystemSourceThatIsOff()]);
    const sourceList = within(screen.getByRole('list', { name: 'Fontes de dados' }));
    fireEvent.click(sourceList.getByRole('button', { name: 'Editar' }));
    const editForm = within(
      screen.getByRole('region', { name: 'Editar fonte: Cronometragem — exemplo' }),
    );
    fireEvent.change(editForm.getByLabelText('Nome da fonte'), {
      target: { value: 'Cronometragem oficial' },
    });

    // Act: press "Salvar fonte".
    pressButton('Salvar fonte');

    // Assert: only the name; the config the form rebuilt is the stored one.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'an unchanged config must not be sent').toEqual([
        {
          type: 'updateDataSource',
          sourceId: 'cronometragem-exemplo',
          label: 'Cronometragem oficial',
        },
      ]);
    });
  });
});
