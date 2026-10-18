/**
 * The flex form's "Testar" panel (apps/control)
 *
 * What this module is for:
 *   Beside the mapping, "Testar" shows what the source would produce before anything is
 *   saved: a sample response per request, fetched by the server with "Buscar da fonte" or
 *   pasted (for an endpoint that is not up yet), and "Testar", which runs the shared
 *   mapping and shape validation in the browser and shows the source detail's own tables,
 *   or the problems. Nothing is sent as a command.
 *
 * What these tests prove:
 *   - The example preset tested on the pasted example response shows the 20 cars in the
 *     positions table and the session card, and sends no command.
 *   - A pasted response with one unreadable lap time shows that problem, naming the car.
 *   - Each sample stays with its own request when a request above it is removed.
 *   - "Buscar da fonte" posts the form's request to the sample route and fills the box
 *     with the body the server fetched; a failure shows the server's pt-BR reason; the
 *     "A fonte respondeu 200." note goes away once the operator edits the text.
 *
 * What these tests deliberately do not cover:
 *   - The sample route itself (the server's fetch, the variables, the 10 s timeout):
 *     apps/server/src/modules/dataSources/httpJsonSampleRoute.test.ts. Here `fetch` is a
 *     stand-in that answers as that route does.
 *   - Every problem line of the mapping: flexSampleTesting.test.ts and the shared tests.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pressButton } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { letThePageFinishWhatItStarted } from '@/state/controlPageOnFakeServer.testSupport';

import {
  importTheExamplePreset,
  openTheNewFlexForm,
  renderPageWithSources,
} from './flexFormOnThePage.testSupport';
import {
  readExampleTimingSystemResponse,
  readExampleTimingSystemResponseText,
} from './timingSystemExample.testSupport';

/** The sample box of the example's one request, inside the "Testar" panel. */
function findSampleBoxOfClassificacao() {
  const testPanel = within(screen.getByRole('region', { name: 'Testar' }));
  return testPanel.getByLabelText('Resposta de exemplo de classificacao (JSON)');
}

/** Pastes a response into the sample box of the example's one request. */
function pasteSampleOfClassificacao(sampleText: string): void {
  fireEvent.change(findSampleBoxOfClassificacao(), { target: { value: sampleText } });
}

/** Adds a second request, "sessao", on the timing system's session address. */
function addTheSessaoRequest(): void {
  pressButton('+ Requisição');
  const secondRequest = within(screen.getByRole('region', { name: 'Requisição 2' }));
  fireEvent.change(secondRequest.getByLabelText('Nome da requisição'), {
    target: { value: 'sessao' },
  });
  fireEvent.change(secondRequest.getByLabelText('Endereço (URL)'), {
    target: { value: 'http://localhost:4790/cronometragem/sessao' },
  });
}

/** Builds a stand-in for `fetch` that answers like the sample route, with this answer. */
function createFetchAnsweringLikeTheSampleRoute(answer: unknown) {
  // Typed as fetch is called, so the test can read the address and body it was given.
  return vi.fn<(address: string, options?: RequestInit) => Promise<Response>>(async () =>
    Response.json(answer),
  );
}

describe('"Testar" with a pasted sample', () => {
  it('shows the 20 cars of the example in the positions table, sending nothing', async () => {
    // Arrange: the example preset imported, the example response pasted.
    const { fakeServer } = renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();
    pasteSampleOfClassificacao(readExampleTimingSystemResponseText());

    // Act: press "Testar" and give the page its moment.
    pressButton('Testar');
    await letThePageFinishWhatItStarted();

    // Assert: a header row and 20 car rows, the leader first; the session card; no command.
    const result = within(screen.getByRole('region', { name: 'Resultado' }));
    const positionsTable = result.getByRole('table', { name: 'Posições' });
    const tableRows = within(positionsTable).getAllByRole('row');
    expect(tableRows, 'the table must show every car of the response').toHaveLength(21);
    expect(tableRows[1], 'the first car in the list is the leader').toHaveTextContent('Acauã Baja');
    expect(
      result.getByText('Enduro de Resistência'),
      'the session card must show the mapped session',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), '"Testar" must send no command').toEqual([]);
  });

  it('shows the problem of one unreadable lap time, naming the car', async () => {
    // Arrange: the example preset, and the example response with the third car's last
    // lap typed as "4:3x.293".
    renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();
    const response = readExampleTimingSystemResponse();
    const thirdCar = response.classificacao[2] as Record<string, unknown>;
    thirdCar.ultima_volta = '4:3x.293';
    pasteSampleOfClassificacao(JSON.stringify(response));

    // Act: press "Testar".
    pressButton('Testar');
    await letThePageFinishWhatItStarted();

    // Assert: the problems list names the car and its line, and there is no table.
    expect(
      screen.getByRole('alert', { name: 'Problemas' }),
      'the problem must name the car, its line and the field',
    ).toHaveTextContent(`Posições › carro ${String(thirdCar.carro)} (linha 3) › Última volta`);
    expect(
      screen.queryByRole('table', { name: 'Posições' }),
      'a failing test must show no table',
    ).not.toBeInTheDocument();
  });
});

describe('the sample boxes', () => {
  it('keep each sample with its own request when a request above it is removed', () => {
    // Arrange: the example preset with a second request "sessao", each with its own
    // pasted sample.
    renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();
    addTheSessaoRequest();
    const testPanel = within(screen.getByRole('region', { name: 'Testar' }));
    const sessaoSampleText = '{ "prova": { "id": "enduro-2027", "bandeira": "VERDE" } }';
    pasteSampleOfClassificacao(readExampleTimingSystemResponseText());
    fireEvent.change(testPanel.getByLabelText('Resposta de exemplo de sessao (JSON)'), {
      target: { value: sessaoSampleText },
    });

    // Act: remove the first request, "classificacao".
    const firstRequest = within(screen.getByRole('region', { name: 'Requisição 1' }));
    fireEvent.click(firstRequest.getByRole('button', { name: 'Remover requisição' }));

    // Assert: one box left, for "sessao", still holding the sample pasted for "sessao".
    expect(
      testPanel.getAllByLabelText(/^Resposta de exemplo de /),
      'only the remaining request must have a sample box',
    ).toHaveLength(1);
    expect(
      testPanel.getByLabelText('Resposta de exemplo de sessao (JSON)'),
      'the remaining request must keep its own sample, never the removed one',
    ).toHaveValue(sessaoSampleText);
  });
});

describe('"Buscar da fonte"', () => {
  it("posts the form's request to the sample route and shows the body fetched", async () => {
    // Arrange: the example preset imported, and a sample route that answers the example.
    const fetchLikeTheSampleRoute = createFetchAnsweringLikeTheSampleRoute({
      ok: true,
      status: 200,
      body: readExampleTimingSystemResponse(),
    });
    vi.stubGlobal('fetch', fetchLikeTheSampleRoute);
    renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();

    // Act: press "Buscar da fonte".
    pressButton('Buscar da fonte');

    // Assert: the request was posted as the form holds it, and the box shows the body.
    await waitFor(() => {
      expect(
        (findSampleBoxOfClassificacao() as HTMLTextAreaElement).value,
        'the box must show the fetched body, indented',
      ).toBe(readExampleTimingSystemResponseText());
    });
    const [address, options] = fetchLikeTheSampleRoute.mock.calls[0] ?? [];
    expect(address, 'the page must ask its own server, never the source').toBe(
      '/api/v1/data-sources/http-json/sample-request',
    );
    expect(JSON.parse(String(options?.body)), 'the body must be the request of the form').toEqual({
      requestId: 'classificacao',
      url: 'http://localhost:4790/cronometragem/classificacao',
      headers: [],
      queryParameters: [],
    });
    expect(screen.getByText('A fonte respondeu 200.'), 'the status must be shown').toBeVisible();
  });

  it("shows the server's pt-BR reason when the source cannot be fetched", async () => {
    // Arrange: the example preset imported, and a source that answers 503 behind the route.
    vi.stubGlobal(
      'fetch',
      createFetchAnsweringLikeTheSampleRoute({
        ok: false,
        error: 'A fonte respondeu 503 (Service Unavailable) em classificacao',
      }),
    );
    renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();

    // Act: press "Buscar da fonte".
    pressButton('Buscar da fonte');

    // Assert: the reason, and the box still empty.
    expect(
      await screen.findByText('A fonte respondeu 503 (Service Unavailable) em classificacao'),
      'the reason must be shown as the server wrote it',
    ).toBeInTheDocument();
    expect(findSampleBoxOfClassificacao(), 'a failed fetch must leave the box alone').toHaveValue(
      '',
    );
  });

  it('drops the "A fonte respondeu 200." note once the operator edits the text', async () => {
    // Arrange: the example preset imported, and its sample fetched from the source.
    vi.stubGlobal(
      'fetch',
      createFetchAnsweringLikeTheSampleRoute({
        ok: true,
        status: 200,
        body: readExampleTimingSystemResponse(),
      }),
    );
    renderPageWithSources();
    openTheNewFlexForm();
    importTheExamplePreset();
    pressButton('Buscar da fonte');
    await screen.findByText('A fonte respondeu 200.');

    // Act: paste another response over the fetched one.
    pasteSampleOfClassificacao('{ "classificacao": [] }');

    // Assert: the note is gone, since the box no longer holds what the source sent.
    expect(
      screen.queryByText('A fonte respondeu 200.'),
      'the note must not describe text the operator changed',
    ).not.toBeInTheDocument();
  });
});
