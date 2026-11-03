/**
 * "Adicionar fonte do app Baja": the ids the operator types, and a table with no points
 * (apps/control)
 *
 * What this module is for:
 *   The picker reads the Baja app's API by ids the operator types: the event ("26BR") and,
 *   for a result left out of the event's menu, its id ("26BR_SPR": 26BR's Super Prime
 *   answers but is in no menu). The API writes ids exactly as stored, case included, so
 *   "26br" is a 404 there; and a result's id says nothing of whether it is a table or a
 *   tournament, which the API's 404 `wrong_type` tells (gate 2 of PR #38). A table that
 *   flags no column as its ranking one has no points to read, so no source is made of it.
 *
 * What these tests prove:
 *   - An event id that is not 4 capital letters or digits ("26br") is refused under its
 *     field, its case left as typed, and nothing is read.
 *   - A table whose columns flag none as the ranking one says so, and "Continuar" stays off.
 *   - "Outro resultado (digite o id)": a tournament's id is read from resultado.php, whose
 *     `wrong_type` sends the page to torneio.php, and is saved as the tournament preset; a
 *     table's id is read and saved as the table preset with its points and scope "other";
 *     an id the event does not have shows the route's sentence; an id of another event or
 *     of the wrong form is refused under its field before anything is read.
 *
 * What these tests deliberately do not cover:
 *   - The event's lists and the presets saved from them: DataSourcesPageBajaApp.test.tsx.
 *   - Reading a table's columns case by case: bajaAppAnswerReading.test.ts.
 *   - The sample route handing on an answer outside 2xx: the server's httpJsonSampleRoute
 *     tests.
 */
import {
  bajaAppApiAddress,
  buildBajaAppBracketSourceConfig,
  buildBajaAppResultsTableSourceConfig,
} from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pressButton, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import { renderPageWithSources } from '../flexSource/flexFormOnThePage.testSupport';
import {
  eventNameOf26BR,
  openTheBajaAppPicker,
  pickChoice,
  readTheEvent,
} from './bajaAppPickerOnThePage.testSupport';
import {
  bajaAppAnswers,
  bajaAppErrorAnswers,
  createSampleRouteAnswering,
  listPostedSampleRequests,
} from './bajaAppSampleRoute.testSupport';

/** Picks "Outro resultado (digite o id)", types the id and presses "Ler resultado". */
function readAnotherResult(resultadoId: string): void {
  fireEvent.click(screen.getByRole('radio', { name: 'Outro resultado (digite o id)' }));
  typeIntoField('Id do resultado', resultadoId);
  pressButton('Ler resultado');
}

/** Where each request the page posted went: its endpoint and the id it asked for. */
function describePostedReads(sampleRoute: ReturnType<typeof createSampleRouteAnswering>) {
  return listPostedSampleRequests(sampleRoute).map((posted) => {
    const endpoint = posted.url.split('/').pop();
    const idAsked = posted.queryParameters.find((parameter) => parameter.name === 'id')?.value;
    return idAsked === undefined ? endpoint : `${endpoint ?? ''} ${idAsked}`;
  });
}

describe('"Adicionar fonte do app Baja", the ids typed', () => {
  it('refuses an event id not written as the API writes it, and reads nothing', () => {
    // Arrange: the route ready, the picker open.
    const sampleRoute = createSampleRouteAnswering({
      'evento.php': bajaAppAnswers.event26BRDuringTheEvent,
    });
    vi.stubGlobal('fetch', sampleRoute);
    renderPageWithSources();
    openTheBajaAppPicker();

    // Act: type "26br", which the API answers 404, and read it.
    typeIntoField('Código do evento', '26br');
    pressButton('Ler evento');

    // Assert: the sentence under the field, the id left as typed, and nothing read.
    const eventIdField = screen.getByLabelText('Código do evento');
    expect(eventIdField, 'the event field says how the id is written').toHaveAccessibleDescription(
      'O código do evento tem 4 letras maiúsculas ou algarismos, como no app Baja: 26BR.',
    );
    expect(eventIdField, 'the case is the operator’s to change').toHaveValue('26br');
    expect(sampleRoute, 'nothing read').not.toHaveBeenCalled();
  });

  it('says a table has no points column when none is flagged, and keeps "Continuar" off', async () => {
    // Arrange: the event, and its Enduro table with no column flagged as the ranking one.
    vi.stubGlobal(
      'fetch',
      createSampleRouteAnswering({
        'evento.php': bajaAppAnswers.event26BRDuringTheEvent,
        'resultado.php': bajaAppAnswers.enduroTableWithNoRankingColumn26BR,
      }),
    );
    renderPageWithSources();
    const picker = openTheBajaAppPicker();
    await readTheEvent('26BR', eventNameOf26BR);

    // Act: pick the Enduro table.
    pickChoice('Tabelas de resultado', 'Enduro');

    // Assert: the sentence, and nothing to continue with.
    expect(
      await screen.findByText(
        'A tabela não tem coluna de pontos: nenhuma coluna é a da classificação.',
      ),
      'the table cannot give points',
    ).toBeInTheDocument();
    expect(picker.getByRole('button', { name: 'Continuar' }), 'no source made').toBeDisabled();
  });
});

describe('"Outro resultado (digite o id)"', () => {
  it('reads a tournament’s id through wrong_type and saves it as the tournament preset', async () => {
    // Arrange: 26BR after its competition (Super Prime in no menu); resultado.php answers
    // 26BR_SPR with the real wrong_type 404, torneio.php with the real tournament.
    const sampleRoute = createSampleRouteAnswering({
      'evento.php': bajaAppAnswers.event26BR,
      'resultado.php?id=26BR_SPR': bajaAppErrorAnswers.tournamentAskedAsATable,
      'torneio.php?id=26BR_SPR': bajaAppAnswers.superPrime26BR,
    });
    vi.stubGlobal('fetch', sampleRoute);
    const { fakeServer } = renderPageWithSources();
    openTheBajaAppPicker();
    await readTheEvent('26BR', eventNameOf26BR);

    // Act: type its id, read it, wait for its name, continue and save.
    readAnotherResult('26BR_SPR');
    await screen.findByText('Chaveamento: Chaveamento Super Prime');
    pressButton('Continuar');
    pressButton('Salvar fonte');

    // Assert: the table endpoint first, then the tournament's; the tournament preset saved.
    expect(describePostedReads(sampleRoute), 'asked as a table, then as a tournament').toEqual([
      'evento.php',
      'resultado.php 26BR_SPR',
      'torneio.php 26BR_SPR',
    ]);
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the tournament preset').toEqual([
        {
          type: 'createDataSource',
          label: 'App Baja — 26BR — Chaveamento Super Prime',
          kind: 'httpJson',
          config: buildBajaAppBracketSourceConfig({
            apiAddress: bajaAppApiAddress,
            eventId: '26BR',
            resultadoId: '26BR_SPR',
          }),
          pollIntervalMs: 5_000,
        },
      ]);
    });
  });

  it('reads a table’s id and saves it as the table preset, scope "other"', async () => {
    // Arrange: the event, and resultado.php answering the real 26BR Enduro table.
    vi.stubGlobal(
      'fetch',
      createSampleRouteAnswering({
        'evento.php': bajaAppAnswers.event26BR,
        'resultado.php?id=26BR_END': bajaAppAnswers.enduroTable26BR,
      }),
    );
    const { fakeServer } = renderPageWithSources();
    openTheBajaAppPicker();
    await readTheEvent('26BR', eventNameOf26BR);

    // Act: type its id, read it, wait for its points column, continue and save.
    readAnotherResult('26BR_END');
    await screen.findByText('Pontos: coluna "Pontos"');
    pressButton('Continuar');
    pressButton('Salvar fonte');

    // Assert: the table preset, its points in "Pontos", no part ticked (none of the
    // overall table's), the scope "other".
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the table preset').toEqual([
        {
          type: 'createDataSource',
          label: 'App Baja — 26BR — Enduro',
          kind: 'httpJson',
          config: buildBajaAppResultsTableSourceConfig({
            apiAddress: bajaAppApiAddress,
            eventId: '26BR',
            resultadoId: '26BR_END',
            pointsHeader: 'Pontos',
            partHeaders: [],
            standingsScope: 'other',
          }),
          pollIntervalMs: 5_000,
        },
      ]);
    });
  });

  it('shows the route’s sentence for an id the event does not have', async () => {
    // Arrange: the event, and resultado.php answering the real not_found 404.
    const sampleRoute = createSampleRouteAnswering({
      'evento.php': bajaAppAnswers.event26BR,
      'resultado.php?id=26BR_ZZZ': bajaAppErrorAnswers.resultNotFound,
    });
    vi.stubGlobal('fetch', sampleRoute);
    const picker = renderThePageWithThePickerOpen();
    await readTheEvent('26BR', eventNameOf26BR);

    // Act: type the id and read it.
    readAnotherResult('26BR_ZZZ');

    // Assert: the route's sentence, no tournament asked (not_found is no wrong_type), and
    // nothing to continue with.
    expect(
      await screen.findByText('A fonte respondeu 404 (Not Found) em resultado'),
      'the route’s own sentence',
    ).toBeInTheDocument();
    expect(describePostedReads(sampleRoute), 'asked as a table only').toEqual([
      'evento.php',
      'resultado.php 26BR_ZZZ',
    ]);
    expect(picker.getByRole('button', { name: 'Continuar' }), 'no source made').toBeDisabled();
  });

  const refusedIdScenarios = [
    // Another event's result: a source of 26BR reading 25SU's would be a mistake.
    { name: 'refuses the id of another event before reading it', typedId: '25SU_SPR' },
    // Case matters to the API, as for the event.
    { name: 'refuses an id in lower case before reading it', typedId: '26BR_spr' },
    // More than 3 letters after "_" is no id the API has.
    { name: 'refuses an id too long after its "_" before reading it', typedId: '26BR_SPRX' },
  ];

  it.each(refusedIdScenarios)('$name', async ({ typedId }) => {
    // Arrange: the event read.
    const sampleRoute = createSampleRouteAnswering({ 'evento.php': bajaAppAnswers.event26BR });
    vi.stubGlobal('fetch', sampleRoute);
    renderThePageWithThePickerOpen();
    await readTheEvent('26BR', eventNameOf26BR);

    // Act: type this row's id and read it.
    readAnotherResult(typedId);

    // Assert: the sentence under the field, and only the event read.
    expect(
      screen.getByLabelText('Id do resultado'),
      'the id field says how an id of 26BR is written',
    ).toHaveAccessibleDescription(
      'O id é o código do evento, "_" e até 3 letras maiúsculas ou algarismos: 26BR_SPR.',
    );
    expect(describePostedReads(sampleRoute), 'only the event read').toEqual(['evento.php']);
  });
});

/** Renders the page and opens the picker, for a test that needs no fake server. */
function renderThePageWithThePickerOpen() {
  renderPageWithSources();
  return openTheBajaAppPicker();
}
