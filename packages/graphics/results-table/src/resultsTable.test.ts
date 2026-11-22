/**
 * The results table web component: load, play, update, the page timer, stop
 * (packages/graphics/results-table)
 *
 * What this module is for:
 *   resultsTable.ts is the OGraf graphic itself (BAJAOVRLAY-83): a web component the
 *   renderer loads, plays, updates, stops and disposes, which turns its own pages while on
 *   air. It wires the model, the order, the columns, the layout and the view; each of those
 *   has its own tests. Its lifecycle is the standings' own, copied.
 *
 * What these tests prove:
 *   - Bad load data answers 400 in pt-BR; play before load 409; an unknown custom action 404.
 *   - load draws page 1 off air as the site shows it: the page's name as the title, the
 *     event line, "16 EQUIPES", the captions POS, Nº, EQUIPE and the page's heads, every
 *     row with the site's rank ("–" during spoilers) and cells as written ("SPOILERS"),
 *     ranks 1 to 3 on the chip.
 *   - The item's settings: a title typed wins over the page's name, "Colunas mostradas"
 *     keeps the columns named, "Ordenar por" and "Sentido" reorder the rows with the site's
 *     ranks kept.
 *   - A live update on air rewrites the rows in place: the same row elements, the new
 *     cells, nothing re-entering.
 *   - The page timer turns 38 rows to page 2 after one hold, "2/2 · 21º A 38º", and stops
 *     turning after stop, which rests the board on page 1.
 *
 * What these tests deliberately do not cover:
 *   - Real motion, fonts and widths: jsdom draws nothing, and with no motion token every
 *     timeline lasts 0 ms. The Playwright suites run the built graphic in Chromium.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  createEnduroPage,
  createOverallPageDuringSpoilers,
  createQualifyingPage,
} from './previewData.js';
import {
  createResultsTableOnThePage,
  listPartsOfResultsTable,
  loadResultsTableWithData,
  placeTokensOnTheRoot,
  readCaptions,
  readCarNumbersOnTheBoard,
  readPageLine,
  readRowTexts,
} from './resultsTableOnThePage.testSupport.js';

/** Fakes setTimeout so the test decides when the page hold ends; real timers come back after. */
function takeControlOfTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

describe('calls made at the wrong moment', () => {
  it('answers 400 with a pt-BR sentence to data without the heads', async () => {
    // Arrange: a table on the page, and the qualifying rows with no heads.
    const resultsTable = createResultsTableOnThePage();

    // Act: load it.
    const answer = await loadResultsTableWithData(resultsTable, {
      entries: createQualifyingPage().entries,
    });

    // Assert: refused, naming the missing field.
    expect(answer, 'data without the heads must answer 400').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "columnHeads".',
    });
  });

  it('answers 409 to playAction before load', async () => {
    // Arrange: a table never loaded.
    const resultsTable = createResultsTableOnThePage();

    // Act: try to play it.
    const answer = await resultsTable.playAction({});

    // Assert: a 409 in pt-BR.
    expect(answer, 'play before load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'A tabela de resultado ainda não foi carregada (load).',
    });
  });

  it('answers 404 to any customAction', async () => {
    // Arrange: a loaded table.
    const resultsTable = createResultsTableOnThePage();
    await loadResultsTableWithData(resultsTable, createQualifyingPage());

    // Act: ask for a custom action.
    const answer = await resultsTable.customAction({ id: 'ordenar', payload: {} });

    // Assert: a 404 naming it.
    expect(answer.statusCode, 'an unknown custom action must answer 404').toBe(404);
  });
});

describe('the page as the site shows it', () => {
  it('draws the overall page during spoilers: no rank, "SPOILERS" as written, car order', async () => {
    // Arrange: a table on the page.
    const resultsTable = createResultsTableOnThePage();

    // Act: load the overall page with spoilers on.
    await loadResultsTableWithData(resultsTable, createOverallPageDuringSpoilers());

    // Assert: the page's name, its heads, Procobaja's row as the site writes it.
    expect(
      listPartsOfResultsTable(resultsTable, 'results-table-title')[0]?.textContent,
      'the page’s own name is the title',
    ).toBe('Geral');
    expect(readPageLine(resultsTable), 'one page of 16').toBe('16 EQUIPES');
    expect(readCaptions(resultsTable), 'the three fixed captions, then the page’s heads').toEqual([
      'POS',
      'Nº',
      'EQUIPE',
      'Segurança',
      'Projeto',
      'Dinâmicas',
      'Enduro',
      'Bônus 4x4',
      'Penalizações',
      'Total',
    ]);
    expect(readRowTexts(resultsTable, 0), 'Procobaja, unranked, hidden cells kept').toEqual([
      '–',
      '1',
      'ProcobajaUTFPR-CP',
      '-20',
      'SPOILERS',
      '203.44',
      '183.97',
      '0',
      '-25',
      'SPOILERS',
    ]);
    expect(
      readCarNumbersOnTheBoard(resultsTable).slice(0, 4),
      'the rows in the site’s order, here by car',
    ).toEqual([1, 2, 3, 4]);
  });

  it('puts ranks 1 to 3 on the chip and shows the first of two laps', async () => {
    // Arrange: a table on the page.
    const resultsTable = createResultsTableOnThePage();

    // Act: load the qualifying page.
    await loadResultsTableWithData(resultsTable, createQualifyingPage());

    // Assert: three medal rows, Imperador's "51.9 / 52.3" shown as 51.9.
    const rows = listPartsOfResultsTable(resultsTable, 'results-table-row');
    const medalRows = rows.filter((row) => row.hasAttribute('data-medal'));
    expect(medalRows.length, 'ranks 1, 2 and 3 sit on the chip').toBe(3);
    expect(readRowTexts(resultsTable, 0).slice(3), 'Imperador’s cells').toEqual([
      '51.9',
      '51.9',
      '91.8%',
      'SIM',
      '1º',
      '100',
    ]);
  });
});

describe('the item’s settings', () => {
  it('uses a typed title, keeps the columns named and orders the rows, ranks kept', async () => {
    // Arrange: the qualifying page with every setting typed.
    const resultsTable = createResultsTableOnThePage();
    const data = {
      ...createQualifyingPage(),
      title: 'CLASSIFICATÓRIA',
      columnsShown: 'Melhor volta, Larga em',
      sortByColumn: 'Melhor volta',
      sortDirection: 'descending' as const,
    };

    // Act: load it.
    await loadResultsTableWithData(resultsTable, data);

    // Assert: the typed title, two columns, Pato (66.4) first still ranked 16.
    expect(
      listPartsOfResultsTable(resultsTable, 'results-table-title')[0]?.textContent,
      'a typed title wins over the page’s name',
    ).toBe('CLASSIFICATÓRIA');
    expect(readCaptions(resultsTable).slice(3), 'only the two columns named').toEqual([
      'Melhor volta',
      'Larga em',
    ]);
    expect(readRowTexts(resultsTable, 0), 'Pato first, its rank the site’s').toEqual([
      '16',
      '12',
      'PatoUTFPR-PB',
      '66.4',
      '-',
    ]);
  });
});

describe('a live update on air', () => {
  it('rewrites the rows in place with the new cells', async () => {
    // Arrange: the qualifying page on air.
    const resultsTable = createResultsTableOnThePage();
    await loadResultsTableWithData(resultsTable, createQualifyingPage());
    await resultsTable.playAction({ skipAnimation: true });
    const rowsBefore = listPartsOfResultsTable(resultsTable, 'results-table-row');

    // Act: send the page again with Imperador's points changed.
    const updatedPage = createQualifyingPage();
    const imperador = updatedPage.entries[0];
    if (imperador !== undefined) {
      imperador.cells = [...imperador.cells.slice(0, 5), '101'];
    }
    const answer = await resultsTable.updateAction({ data: { entries: updatedPage.entries } });

    // Assert: accepted, the same row elements, the new points.
    const rowsAfter = listPartsOfResultsTable(resultsTable, 'results-table-row');
    expect(answer, 'the update must be accepted').toEqual({ statusCode: 200 });
    expect(rowsAfter, 'the rows on air are the same elements').toEqual(rowsBefore);
    expect(readRowTexts(resultsTable, 0).at(-1), 'Imperador’s new points').toBe('101');
  });
});

describe('the page timer', () => {
  it('turns 38 rows to page 2 after one hold, and rests on page 1 after stop', async () => {
    // Arrange: Ardósia's 10 s hold, and 26BR's Enduro on air.
    takeControlOfTimers();
    placeTokensOnTheRoot({ '--motion-board-hold': '10000ms' });
    const resultsTable = createResultsTableOnThePage();
    await loadResultsTableWithData(resultsTable, createEnduroPage());
    await resultsTable.playAction({ skipAnimation: true });

    // Act: let one hold pass, read the page, then stop.
    await vi.advanceTimersByTimeAsync(10_000);
    const pageLineOnPageTwo = readPageLine(resultsTable);
    const rowCountOnPageTwo = readCarNumbersOnTheBoard(resultsTable).length;
    await resultsTable.stopAction({ skipAnimation: true });

    // Assert: page 2 with 18 rows, then page 1 again off air.
    expect(pageLineOnPageTwo, 'page 2 after one hold').toBe('2/2 · 21º A 38º');
    expect(rowCountOnPageTwo, 'the last 18 rows').toBe(18);
    expect(readPageLine(resultsTable), 'off air the board rests on page 1').toBe('1/2 · 1º A 20º');
  });
});
