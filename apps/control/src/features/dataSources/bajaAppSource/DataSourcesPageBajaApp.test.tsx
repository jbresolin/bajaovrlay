/**
 * "Adicionar fonte do app Baja" on the Fontes page (apps/control)
 *
 * What this module is for:
 *   The Baja app's public results API becomes a working flex source in a few clicks
 *   (BAJAOVRLAY-54). The operator types the event id; the page reads the event (evento.php)
 *   through the server's sample route, so nothing is fetched from the browser, and lists
 *   its lap-counted races, its results tables and its tournaments by their pt-BR names.
 *   The chosen one's preset (packages/shared, presets/bajaApp) is filled in and opens in the
 *   ordinary flex form, where "Salvar fonte" saves it like any flex source.
 *
 * What these tests prove:
 *   - The event is read through the sample route with the id typed, and its three lists
 *     are shown; an event with no race and no tournament says so.
 *   - A race chosen with "Aceitar corrida simulada" ticked opens the flex form filled in,
 *     and is saved as the race preset with the simulation accepted, every 2 s.
 *   - A table chosen reads the table, proposes its points column ("Total") and the overall
 *     table's parts, and is saved with the parts the operator left ticked, every 5 s.
 *   - A tournament chosen is saved as the tournament preset.
 *   - A typed address of a local copy of the API is used for every request.
 *   - The route's sentence is shown when the event cannot be read, and nothing opens.
 *   - Nothing is read without an event id and an http(s) address, each refusal under
 *     its own field.
 *
 * What these tests deliberately do not cover:
 *   - What each preset makes of the API's answers: bajaAppPresets.test.ts (packages/shared).
 *   - The flex form once open ("Testar", import, export): the flexSource/ tests.
 *   - The real server fetching the API: the e2e walk (bajaAppSourcesWalk.e2e.ts).
 */
import {
  bajaAppApiAddress,
  buildBajaAppBracketSourceConfig,
  buildBajaAppRaceSourceConfig,
  buildBajaAppResultsTableSourceConfig,
} from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pressButton, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import { renderPageWithSources } from '../flexSource/flexFormOnThePage.testSupport';
import {
  bajaAppAnswers,
  createSampleRouteAnswering,
  listPostedSampleRequests,
} from './bajaAppSampleRoute.testSupport';

/** The name of the Baja app picker's region. */
const pickerName = 'Nova fonte do app Baja';

/** Presses "+ Fonte" and "Adicionar fonte do app Baja", which opens the picker. */
function openTheBajaAppPicker() {
  pressButton('+ Fonte');
  const kindChoice = within(screen.getByRole('group', { name: 'Que tipo de fonte?' }));
  fireEvent.click(kindChoice.getByRole('button', { name: 'Adicionar fonte do app Baja' }));
  return within(screen.getByRole('region', { name: pickerName }));
}

/** Types an event id into the picker and presses "Ler evento"; waits for its name. */
async function readTheEvent(eventId: string, expectedEventName: string) {
  typeIntoField('Código do evento', eventId);
  pressButton('Ler evento');
  await screen.findByText(expectedEventName);
}

/** The radio buttons of one list of the picker, by their names. */
function listChoicesOf(listName: string): string[] {
  const list = within(screen.getByRole('group', { name: listName }));
  return list.queryAllByRole('radio').map((radio) => radio.getAttribute('aria-label') ?? '');
}

/** Picks one entry of a list by its name. */
function pickChoice(listName: string, choiceName: string): void {
  const list = within(screen.getByRole('group', { name: listName }));
  fireEvent.click(list.getByRole('radio', { name: choiceName }));
}

/** 26BR's event name, as the API gives it. */
const eventNameOf26BR = '31ª Competição Baja SAE BRASIL';

describe('"Adicionar fonte do app Baja"', () => {
  it('reads the event through the sample route and lists its races, tables and tournaments', async () => {
    // Arrange: the sample route answering the made-up 26BR during its competition.
    const sampleRoute = createSampleRouteAnswering({
      'evento.php': bajaAppAnswers.event26BRDuringTheEvent,
    });
    vi.stubGlobal('fetch', sampleRoute);
    renderPageWithSources();
    openTheBajaAppPicker();

    // Act: type 26BR and read it.
    await readTheEvent('26BR', eventNameOf26BR);

    // Assert: the event asked for through the route, and the three lists by name.
    expect(listPostedSampleRequests(sampleRoute), 'the event, read by the server').toEqual([
      {
        requestId: 'evento',
        url: 'https://api.bajasaebrasil.net/resultados/evento.php',
        headers: [],
        queryParameters: [{ name: 'evt', value: '26BR' }],
      },
    ]);
    expect(sampleRoute.mock.calls[0]?.[0], 'only the page’s own server is asked').toBe(
      '/api/v1/data-sources/http-json/sample-request',
    );
    expect(listChoicesOf('Corridas com contagem de voltas'), 'the lap-counted Enduro').toEqual([
      'Enduro',
    ]);
    expect(listChoicesOf('Chaveamentos'), 'the Super Prime bracket').toEqual([
      'Chaveamento Super Prime',
    ]);
    const tables = listChoicesOf('Tabelas de resultado');
    expect(tables, 'every table of 26BR, 21 in all').toHaveLength(21);
    expect(tables.slice(0, 2), 'in the API’s order').toEqual([
      'Segurança Estática',
      'Segurança Dinâmica',
    ]);
    expect(tables.at(-1), 'the overall table last').toBe('Geral');
  });

  it('says so when the event has no lap-counted race and no tournament', async () => {
    // Arrange: the real 26BR answer, after the competition: tables only.
    vi.stubGlobal('fetch', createSampleRouteAnswering({ 'evento.php': bajaAppAnswers.event26BR }));
    renderPageWithSources();
    openTheBajaAppPicker();

    // Act: read the event.
    await readTheEvent('26BR', eventNameOf26BR);

    // Assert: the two empty lists say so in words.
    expect(
      screen.getByText('Nenhuma corrida com contagem de voltas neste evento.'),
      'no race',
    ).toBeInTheDocument();
    expect(screen.getByText('Nenhum chaveamento neste evento.'), 'no bracket').toBeInTheDocument();
  });

  it('saves the chosen race as the race preset, the simulation accepted when ticked', async () => {
    // Arrange: the event read, the Enduro picked, "Aceitar corrida simulada" ticked.
    vi.stubGlobal(
      'fetch',
      createSampleRouteAnswering({ 'evento.php': bajaAppAnswers.event26BRDuringTheEvent }),
    );
    const { fakeServer } = renderPageWithSources();
    openTheBajaAppPicker();
    await readTheEvent('26BR', eventNameOf26BR);
    pickChoice('Corridas com contagem de voltas', 'Enduro');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aceitar corrida simulada' }));

    // Act: "Continuar", then "Salvar fonte" in the flex form it opens.
    pressButton('Continuar');
    const flexForm = within(
      screen.getByRole('region', { name: 'Nova fonte: HTTP/JSON (flexível)' }),
    );
    const typedLabel = (flexForm.getByLabelText('Nome da fonte') as HTMLInputElement).value;
    pressButton('Salvar fonte');

    // Assert: the form was named for the race, and the race preset is sent whole.
    expect(typedLabel, 'the source is named for the event and the race').toBe(
      'App Baja — 26BR — Enduro',
    );
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the race preset, simulation accepted').toEqual([
        {
          type: 'createDataSource',
          label: 'App Baja — 26BR — Enduro',
          kind: 'httpJson',
          config: buildBajaAppRaceSourceConfig({
            apiAddress: bajaAppApiAddress,
            eventId: '26BR',
            provaId: 'END',
            acceptsSimulatedRace: true,
          }),
          pollIntervalMs: 2_000,
        },
      ]);
    });
  });

  it('reads the chosen table, proposes its points and parts, and saves the parts left ticked', async () => {
    // Arrange: the event read, and the sample route also answering the real 26BR table.
    const sampleRoute = createSampleRouteAnswering({
      'evento.php': bajaAppAnswers.event26BRDuringTheEvent,
      'resultado.php': bajaAppAnswers.overall26BR,
    });
    vi.stubGlobal('fetch', sampleRoute);
    const { fakeServer } = renderPageWithSources();
    openTheBajaAppPicker();
    await readTheEvent('26BR', eventNameOf26BR);

    // Act: pick "Geral", wait for its columns, untick "Enduro", continue and save.
    pickChoice('Tabelas de resultado', 'Geral');
    const parts = within(await screen.findByRole('group', { name: 'Partes da pontuação' }));
    const isTotalShownAsThePoints = screen.queryByText('Pontos: coluna "Total"') !== null;
    const partsTickedAtFirst = parts
      .getAllByRole('checkbox')
      .filter((checkbox) => (checkbox as HTMLInputElement).checked)
      .map((checkbox) => checkbox.getAttribute('aria-label'));
    fireEvent.click(parts.getByRole('checkbox', { name: 'Enduro' }));
    pressButton('Continuar');
    pressButton('Salvar fonte');

    // Assert: the table read through the route, "Total" as the points, the overall
    // table's five parts proposed (not "Região"), and the four left ticked saved.
    expect(listPostedSampleRequests(sampleRoute)[1], 'the table, read by the server').toEqual({
      requestId: 'resultado',
      url: 'https://api.bajasaebrasil.net/resultados/resultado.php',
      headers: [],
      queryParameters: [
        { name: 'evt', value: '26BR' },
        { name: 'id', value: '26BR_GER' },
      ],
    });
    expect(isTotalShownAsThePoints, 'the ranking column is shown as the points').toBe(true);
    expect(partsTickedAtFirst, 'the overall table’s five parts proposed').toEqual([
      'Penalidade',
      'Segurança',
      'Projeto',
      'Dinâmicas',
      'Enduro',
    ]);
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the table preset, four parts').toEqual([
        {
          type: 'createDataSource',
          label: 'App Baja — 26BR — Geral',
          kind: 'httpJson',
          config: buildBajaAppResultsTableSourceConfig({
            apiAddress: bajaAppApiAddress,
            eventId: '26BR',
            resultadoId: '26BR_GER',
            pointsHeader: 'Total',
            partHeaders: ['Penalidade', 'Segurança', 'Projeto', 'Dinâmicas'],
            standingsScope: 'overall',
          }),
          pollIntervalMs: 5_000,
        },
      ]);
    });
  });

  it('saves the chosen tournament as the tournament preset, on the address typed', async () => {
    // Arrange: a local copy of the API typed, and the event read from it.
    const sampleRoute = createSampleRouteAnswering({
      'evento.php': bajaAppAnswers.event26BRDuringTheEvent,
    });
    vi.stubGlobal('fetch', sampleRoute);
    const { fakeServer } = renderPageWithSources();
    openTheBajaAppPicker();
    typeIntoField('Endereço da API', 'http://127.0.0.1:4791');
    await readTheEvent('26BR', eventNameOf26BR);

    // Act: pick the Super Prime bracket, continue and save.
    pickChoice('Chaveamentos', 'Chaveamento Super Prime');
    pressButton('Continuar');
    pressButton('Salvar fonte');

    // Assert: the event read from the local copy, and the tournament preset saved on it.
    expect(listPostedSampleRequests(sampleRoute)[0]?.url, 'the local copy is read').toBe(
      'http://127.0.0.1:4791/resultados/evento.php',
    );
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the tournament preset').toEqual([
        {
          type: 'createDataSource',
          label: 'App Baja — 26BR — Chaveamento Super Prime',
          kind: 'httpJson',
          config: buildBajaAppBracketSourceConfig({
            apiAddress: 'http://127.0.0.1:4791',
            eventId: '26BR',
            resultadoId: '26BR_SPR',
          }),
          pollIntervalMs: 5_000,
        },
      ]);
    });
  });

  it('shows the route’s sentence when the event cannot be read, and opens nothing', async () => {
    // Arrange: a sample route that knows no endpoint: every read answers 404.
    vi.stubGlobal('fetch', createSampleRouteAnswering({}));
    renderPageWithSources();
    const picker = openTheBajaAppPicker();

    // Act: type an event that is not there and read it.
    typeIntoField('Código do evento', '99XX');
    pressButton('Ler evento');

    // Assert: the sentence, no list, and "Continuar" off.
    expect(
      await screen.findByText('A fonte respondeu 404 (Not Found) em evento'),
      'the route’s own sentence',
    ).toBeInTheDocument();
    expect(picker.queryAllByRole('radio'), 'nothing to choose').toEqual([]);
    expect(
      picker.getByRole('button', { name: 'Continuar' }),
      'nothing to continue with',
    ).toBeDisabled();
  });

  it('reads nothing without an event id and an http address, each said under its field', () => {
    // Arrange: the route ready, the picker open.
    const sampleRoute = createSampleRouteAnswering({
      'evento.php': bajaAppAnswers.event26BRDuringTheEvent,
    });
    vi.stubGlobal('fetch', sampleRoute);
    renderPageWithSources();
    openTheBajaAppPicker();

    // Act: an address with no http:// typed, no event, and "Ler evento".
    typeIntoField('Endereço da API', 'api.bajasaebrasil.net');
    pressButton('Ler evento');

    // Assert: both sentences, each described by its own field, and nothing read.
    expect(
      screen.getByLabelText('Endereço da API'),
      'the address field',
    ).toHaveAccessibleDescription('O endereço da API começa com http:// ou https://.');
    expect(
      screen.getByLabelText('Código do evento'),
      'the event field',
    ).toHaveAccessibleDescription('Digite o código do evento.');
    expect(sampleRoute, 'nothing read').not.toHaveBeenCalled();
  });
});
