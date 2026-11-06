/**
 * The "Histórico" page (apps/control)
 *
 * What this module is for:
 *   Every change of the show can be read back in plain pt-BR (concept §7 rule 4,
 *   BAJAOVRLAY-30). The page at "#/historico" lists the event log newest first: the time,
 *   who sent it and one sentence, a refusal marked. The newest 200 rows arrive live in the
 *   eventLog slice; "Carregar mais" reads older ones from GET /api/v1/event-log with the
 *   page's filters, which run on the live rows here and on the older ones on the server.
 *
 * What these tests prove (the page wired as in the browser, on a fake server):
 *   - The live rows come newest first with their time, who and sentence; a refusal reads
 *     "Recusado: …" and carries its reason.
 *   - Each filter keeps its rows: who, type of command, layer, only refusals, and a free
 *     text typed without accents.
 *   - A row arriving live goes on top by itself.
 *   - "Carregar mais" is offered once the live slice is full (200 rows) and asks the route
 *     for the rows below the oldest one shown, with the filters; the older rows go below,
 *     and the button goes once the server says nothing older is left.
 *   - A request that looked at its 5,000 rows and found nothing (gate 2 of PR #44): the page
 *     says "Procurando em registros mais antigos…" and asks below where it stopped by
 *     itself, until rows come or the log ends.
 *   - With fewer than 200 live rows the slice is the whole log, and nothing is offered.
 *
 * What these tests deliberately do not cover:
 *   - The sentence of each command type; packages/shared's sentence tests.
 *   - The route's own paging and filtering; apps/server's eventLogRoute.test.ts.
 *   - The CSV text itself; historyCsv.test.ts.
 */
import type { EventLogEntry, Item, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildEnduranceStartClockItem,
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { HistoryPage } from './HistoryPage';

const startClockItem = buildEnduranceStartClockItem();
const interviewItem = buildInterviewLowerThirdItem();

/**
 * Four rows of a race morning: the operator takes the start clock (14:00:00), Companion
 * takes the interview lower third (14:01:00), the macro "Abertura" clears the clock
 * (14:02:00), and the operator's take of a deleted item is refused (14:03:00).
 */
function buildFourRowsOfARaceMorning(): EventLogEntry[] {
  return [
    {
      id: 41,
      ts: '2026-11-05T14:00:00.000Z',
      actor: 'operador:conexao-7',
      command: 'takeItem',
      payload: { type: 'takeItem', itemId: startClockItem.id },
      result: { status: 'ok' },
    },
    {
      id: 42,
      ts: '2026-11-05T14:01:00.000Z',
      actor: 'api:companion',
      command: 'takeItem',
      payload: { type: 'takeItem', itemId: interviewItem.id },
      result: { status: 'ok' },
    },
    {
      id: 43,
      ts: '2026-11-05T14:02:00.000Z',
      actor: 'sistema:macro:abertura',
      command: 'clearLayer',
      payload: { type: 'clearLayer', layerId: 'clock' },
      result: { status: 'ok' },
    },
    {
      id: 44,
      ts: '2026-11-05T14:03:00.000Z',
      actor: 'operador:conexao-7',
      command: 'takeItem',
      payload: { type: 'takeItem', itemId: 'item-tarja-apagada' },
      result: {
        status: 'failed',
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'O item "item-tarja-apagada" não existe; ele pode ter sido excluído.',
        },
      },
    },
  ];
}

/** The page's slices: the two items prepared and the given event log. */
function buildSlicesWithEventLog(eventLog: EventLogEntry[]): Slices {
  const items: Item[] = [startClockItem, interviewItem];
  return { ...buildSlicesWithTheRaceClockAndTheLowerThird(), items, eventLog };
}

/** A full live slice: 200 cursor moves by the operator, ids 1001 to 1200. */
function buildFullLiveSliceOfCursorMoves(): EventLogEntry[] {
  return Array.from({ length: 200 }, (_unused, index) => ({
    id: 1001 + index,
    ts: '2026-11-05T15:00:00.000Z',
    actor: 'operador:conexao-7',
    command: 'moveCursor',
    payload: { type: 'moveCursor', rundownId: 'sessao-principal', itemId: startClockItem.id },
    result: { status: 'ok' as const },
  }));
}

/** The sentences of the table's rows, top to bottom. */
function readSentencesShown(): string[] {
  const table = screen.getByRole('table', { name: 'Histórico de comandos' });
  const bodyRows = within(table).getAllByRole('row').slice(1);
  return bodyRows.map((row) => within(row).getAllByRole('cell')[2]?.textContent ?? '');
}

/** Opens one of the filter dropdowns and picks an option, by the names the operator reads. */
function chooseInFilter(filterName: string, optionName: string): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: filterName }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('the live rows of the history', () => {
  it('lists them newest first, with who sent each and a refusal marked', () => {
    // Arrange: the four rows of the race morning.
    renderOnControlPageConnectedToFakeServer(
      <HistoryPage />,
      buildSlicesWithEventLog(buildFourRowsOfARaceMorning()),
    );

    // Act: read the table.
    const table = screen.getByRole('table', { name: 'Histórico de comandos' });
    const bodyRows = within(table).getAllByRole('row').slice(1);

    // Assert: newest first, each with its sender, and the refusal marked with its reason.
    expect(
      bodyRows.map((row) => within(row).getAllByRole('cell')[1]?.textContent),
      'the "Quem" column must name each sender as the operator knows them',
    ).toEqual(['Operador', 'Macro', 'API · companion', 'Operador']);
    expect(readSentencesShown(), 'each row must be one sentence in pt-BR, newest first').toEqual([
      'Recusado: Tomou item excluído (item-tarja-apagada) — O item "item-tarja-apagada" não existe; ele pode ter sido excluído.',
      'Limpou a camada Relógio (Programa)',
      'Tomou "Tarja da equipe 42" na camada Tarja (Programa)',
      'Tomou "Largada do Enduro" na camada Relógio (Programa)',
    ]);
  });

  it('puts a row that arrives live on top by itself', () => {
    // Arrange: the four rows of the race morning on screen.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <HistoryPage />,
      buildSlicesWithEventLog(buildFourRowsOfARaceMorning()),
    );

    // Act: the server sends the slice with "Limpar tudo" pressed at 14:04.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'eventLog',
      slice: [
        ...buildFourRowsOfARaceMorning(),
        {
          id: 45,
          ts: '2026-11-05T14:04:00.000Z',
          actor: 'operador:conexao-7',
          command: 'clearAll',
          payload: { type: 'clearAll' },
          result: { status: 'ok' },
        },
      ],
      serverNowMs: Date.parse('2026-11-05T14:04:00.000Z'),
    });

    // Assert: it is the first row.
    expect(readSentencesShown()[0], 'the newest row must be on top').toBe('Limpou tudo');
  });
});

describe('the filters of the history', () => {
  const filterScenarios = [
    // Companion is the only device of the command API this morning.
    {
      name: 'keeps the rows of one kind of sender',
      chooseTheFilter: () => chooseInFilter('Quem', 'API'),
      expectedSentences: ['Tomou "Tarja da equipe 42" na camada Tarja (Programa)'],
    },
    // A take on the lower third is the only row about the "Tarja" layer.
    {
      name: 'keeps the rows that touch one layer',
      chooseTheFilter: () => chooseInFilter('Camada', 'Tarja'),
      expectedSentences: ['Tomou "Tarja da equipe 42" na camada Tarja (Programa)'],
    },
    // Every row of the morning is a take or a clear.
    {
      name: 'keeps the rows of one type of command',
      chooseTheFilter: () => chooseInFilter('Tipo de comando', 'Prévias'),
      expectedSentences: [],
    },
    // Only the take of the deleted item was refused.
    {
      name: 'keeps only the refusals',
      chooseTheFilter: () => fireEvent.click(screen.getByRole('switch', { name: 'Só recusas' })),
      expectedSentences: [
        'Recusado: Tomou item excluído (item-tarja-apagada) — O item "item-tarja-apagada" não existe; ele pode ter sido excluído.',
      ],
    },
    // Typed in a hurry: no accent, small letters.
    {
      name: 'keeps the rows whose sentence holds a text typed without accents',
      chooseTheFilter: () =>
        fireEvent.change(screen.getByLabelText('Buscar no texto'), {
          target: { value: 'camada relogio' },
        }),
      expectedSentences: [
        'Limpou a camada Relógio (Programa)',
        'Tomou "Largada do Enduro" na camada Relógio (Programa)',
      ],
    },
  ];

  it.each(filterScenarios)('$name', ({ chooseTheFilter, expectedSentences }) => {
    // Arrange: the four rows of the race morning.
    renderOnControlPageConnectedToFakeServer(
      <HistoryPage />,
      buildSlicesWithEventLog(buildFourRowsOfARaceMorning()),
    );

    // Act: set the filter.
    chooseTheFilter();

    // Assert: exactly the rows it keeps, or the line that says there is none.
    if (expectedSentences.length === 0) {
      expect(
        screen.getByText('Nenhuma linha com esses filtros.'),
        'a filter that keeps nothing must say so',
      ).toBeDefined();
      return;
    }
    expect(readSentencesShown(), 'the filter must keep exactly its rows').toEqual(
      expectedSentences,
    );
  });
});

describe('"Carregar mais"', () => {
  it('asks for the rows below the oldest one shown, with the filters, and shows them below', async () => {
    // Arrange: a full live slice of cursor moves, the "Só recusas" filter on, and a server
    // that answers one older refusal and nothing below it.
    const olderRefusal = buildFourRowsOfARaceMorning()[3];
    const fetchTheOlderPage = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ entries: [olderRefusal], hasOlder: false }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchTheOlderPage);
    renderOnControlPageConnectedToFakeServer(
      <HistoryPage />,
      buildSlicesWithEventLog(buildFullLiveSliceOfCursorMoves()),
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Só recusas' }));

    // Act: press "Carregar mais".
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    // Assert: one request below row 1001 with the filter; the refusal shown; no more button.
    expect(
      fetchTheOlderPage.mock.calls.map((call) => String((call as unknown[])[0])),
      'the page must ask for the rows below the oldest live one, with its filter',
    ).toEqual(['/api/v1/event-log?before=1001&onlyRefusals=true']);
    await waitFor(() => {
      expect(readSentencesShown(), 'the older refusal must be shown').toEqual([
        'Recusado: Tomou item excluído (item-tarja-apagada) — O item "item-tarja-apagada" não existe; ele pode ter sido excluído.',
      ]);
    });
    expect(
      screen.queryByRole('button', { name: 'Carregar mais' }),
      'with nothing older left the button must go',
    ).toBeNull();
  });

  it('goes on by itself, saying it is searching, while a request finds nothing below', async () => {
    // Arrange: a full live slice of cursor moves and "Só recusas" on; the server's first
    // answer found nothing in the 5,000 rows it looked at and stopped at row 801; its second
    // answer, held back until the test lets it go, is one older refusal.
    const olderRefusal = buildFourRowsOfARaceMorning()[3];
    let letTheSecondAnswerGo: (response: Response) => void = () => undefined;
    const fetchTheOlderPage = vi
      .fn<(address: string) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ entries: [], hasOlder: true, nextBefore: 801 }), {
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          letTheSecondAnswerGo = resolve;
        }),
      );
    vi.stubGlobal('fetch', fetchTheOlderPage);
    renderOnControlPageConnectedToFakeServer(
      <HistoryPage />,
      buildSlicesWithEventLog(buildFullLiveSliceOfCursorMoves()),
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Só recusas' }));

    // Act: press "Carregar mais" once.
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    // Assert: the page says it is searching and asks below row 801 by itself; once the
    // refusal arrives it is shown, and the line and the button go.
    await waitFor(() => {
      expect(
        screen.getByText('Procurando em registros mais antigos…'),
        'while a request finds nothing below, the page must say it is still searching',
      ).toBeDefined();
    });
    expect(
      fetchTheOlderPage.mock.calls.map((call) => call[0]),
      'the second request must start where the first one stopped, without a second press',
    ).toEqual([
      '/api/v1/event-log?before=1001&onlyRefusals=true',
      '/api/v1/event-log?before=801&onlyRefusals=true',
    ]);
    letTheSecondAnswerGo(
      new Response(JSON.stringify({ entries: [olderRefusal], hasOlder: false }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    await waitFor(() => {
      expect(readSentencesShown(), 'the refusal found further down must be shown').toEqual([
        'Recusado: Tomou item excluído (item-tarja-apagada) — O item "item-tarja-apagada" não existe; ele pode ter sido excluído.',
      ]);
    });
    expect(
      screen.queryByText('Procurando em registros mais antigos…'),
      'with the search over, the line must go',
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Carregar mais' }),
      'with nothing older left the button must go',
    ).toBeNull();
  });

  it('is not offered while the live rows are the whole log', () => {
    // Arrange: only the four rows of the morning.
    renderOnControlPageConnectedToFakeServer(
      <HistoryPage />,
      buildSlicesWithEventLog(buildFourRowsOfARaceMorning()),
    );

    // Act: look for the button.
    const loadMoreButton = screen.queryByRole('button', { name: 'Carregar mais' });

    // Assert: there is nothing older to load.
    expect(loadMoreButton, 'fewer than 200 live rows are the whole log').toBeNull();
  });
});
