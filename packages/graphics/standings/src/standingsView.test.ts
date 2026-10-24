/**
 * The standings' DOM, in pt-BR (packages/graphics/standings)
 *
 * What this module is for:
 *   standingsView.ts draws the board: the head card (title, event line, page line), and
 *   for a page one table (the overall table) or up to three (the columns board), each a
 *   column-head pill over row pills, the rows reused by slot when a page is drawn again.
 *
 * What these tests prove, reading the texts a viewer would read:
 *   - The table's column head names POS, Nº, EQUIPE, the six parts and TOTAL; its rows
 *     carry the rank, the car, the team and school, the parts and the total in the
 *     board's format, with "—" for Forja Baja's unknown 4X4.
 *   - A disqualified team's row shows "—" and "DESCL." and is marked for dimming.
 *   - Tied rank 1 puts both teams on the green chip (the leader mark).
 *   - The columns board draws one table per column, headed PONTOS, and none for an empty
 *     column; the head's line and title are written, the event line hidden when empty.
 *   - Drawing a page again reuses the same row elements (an update never rebuilds a row).
 *
 * What these tests deliberately do not cover:
 *   - The look (Playwright screenshots) and the motion (standingsAnimations.test.ts).
 */
import { render } from 'lit';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  createEnduroStandings,
  createOverallStandingsEntries,
  overallScoreParts,
} from './previewData.js';
import { layOutStandingsPage } from './standingsLayout.js';
import type { StandingsEntry } from './standingsModel.js';
import {
  drawStandingsPage,
  findStandingsParts,
  renderStandingsTemplate,
  type StandingsParts,
  writeStandingsHead,
} from './standingsView.js';

/** Draws the template into a fresh container on the page and finds its parts. */
function createBoardOnThePage(): StandingsParts {
  const container = document.createElement('div');
  document.body.append(container);
  onTestFinished(() => container.remove());
  render(renderStandingsTemplate(), container);
  return findStandingsParts(container, container);
}

/** The texts of the cells of one element, by test id, in order. */
function readTextsOf(element: Element, testId: string): string[] {
  return [...element.querySelectorAll(`[data-testid="${testId}"]`)].map(
    (cell) => cell.textContent ?? '',
  );
}

/** The rows of the board, every table, top to bottom. */
function listRows(parts: StandingsParts): HTMLElement[] {
  return [...parts.tables.querySelectorAll<HTMLElement>('[data-testid="standings-row"]')];
}

/** The text of every cell of one row, rank to total. */
function readRowCells(row: HTMLElement): string[] {
  return [...(row.firstElementChild?.children ?? [])].map((cell) => cell.textContent ?? '');
}

describe('the overall table', () => {
  it('heads its columns POS, Nº, EQUIPE, the six parts and TOTAL', () => {
    // Arrange: an empty board and page 1 of the real export.
    const parts = createBoardOnThePage();
    const page = layOutStandingsPage(createOverallStandingsEntries(), 'table', 1);

    // Act: draw the page off air.
    drawStandingsPage(parts, page, overallScoreParts, 'offAir');

    // Assert: one table, its captions as the design writes them.
    const columnHeads = parts.tables.querySelectorAll('[data-testid="standings-column-head"]');
    expect(columnHeads, 'the table has one column head').toHaveLength(1);
    expect(
      [...(columnHeads[0]?.children ?? [])].map((caption) => caption.textContent),
      'the captions must name every column in pt-BR',
    ).toEqual([
      'POS',
      'Nº',
      'EQUIPE',
      'PROJETO',
      'DINÂM.',
      'ENDURO',
      '4X4',
      'SEG.',
      'PEN.',
      'TOTAL',
    ]);
  });

  it('writes Baja UFMG’s row with its parts and total, and "—" for Forja Baja’s unknown 4X4', () => {
    // Arrange: an empty board and page 1 of the real export.
    const parts = createBoardOnThePage();
    const page = layOutStandingsPage(createOverallStandingsEntries(), 'table', 1);

    // Act: draw the page.
    drawStandingsPage(parts, page, overallScoreParts, 'offAir');

    // Assert: 20 rows; the first and the 17th read as the design page shows them.
    const rows = listRows(parts);
    expect(rows, 'page 1 holds 20 rows').toHaveLength(20);
    expect(rows[0] ? readRowCells(rows[0]) : [], 'Baja UFMG’s row').toEqual([
      '1',
      '2',
      'Baja UFMGUFMG',
      '246,81',
      '227,49',
      '312,5',
      '150',
      '−15',
      '0',
      '921,8',
    ]);
    expect(rows[16] ? readTextsOf(rows[16], 'row-part') : [], 'Forja Baja’s parts').toEqual([
      '152,01',
      '64,83',
      '325',
      '—',
      '−15',
      '0',
    ]);
  });

  it('shows a disqualified team with "—" as its rank and "DESCL." as its total, marked for dimming', () => {
    // Arrange: an empty board and page 3, which ends with the four disqualified teams.
    const parts = createBoardOnThePage();
    const page = layOutStandingsPage(createOverallStandingsEntries(), 'table', 3);

    // Act: draw the page.
    drawStandingsPage(parts, page, overallScoreParts, 'offAir');

    // Assert: the last row is Equipistão (car 57), rankless, "DESCL.", dimmed.
    const lastRow = listRows(parts).at(-1);
    expect(lastRow?.dataset.carNumber, 'the last row is car 57').toBe('57');
    expect(lastRow ? readTextsOf(lastRow, 'row-rank') : [], 'its rank is the dash').toEqual(['—']);
    expect(lastRow ? readTextsOf(lastRow, 'row-total') : [], 'its total is DESCL.').toEqual([
      'DESCL.',
    ]);
    expect(lastRow?.hasAttribute('data-disqualified'), 'the row is marked for dimming').toBe(true);
    expect(lastRow?.hasAttribute('data-leader'), 'a disqualified team is never the leader').toBe(
      false,
    );
  });

  it('puts both teams tied first on the green chip', () => {
    // Arrange: a board, and two teams tied on 400 points at the top.
    const parts = createBoardOnThePage();
    const tiedEntries: StandingsEntry[] = [
      { rank: 1, carNumber: 51, teamName: 'Sinuelo', schoolName: 'FAHOR', points: 400 },
      { rank: 1, carNumber: 1, teamName: 'Equipe FEI Baja', schoolName: 'FEI', points: 400 },
      { rank: 3, carNumber: 10, teamName: 'Equipe Komiketo Baja', schoolName: 'UFSJ', points: 375 },
    ];
    const page = layOutStandingsPage(tiedEntries, 'table', 1);

    // Act: draw the page.
    drawStandingsPage(parts, page, overallScoreParts, 'offAir');

    // Assert: the shared number on both, the leader mark on both, not on the third.
    const rows = listRows(parts);
    expect(
      rows.map((row) => readTextsOf(row, 'row-rank')[0]),
      'tied teams share a number',
    ).toEqual(['1', '1', '3']);
    expect(
      rows.map((row) => row.hasAttribute('data-leader')),
      'rank 1, tied or not, is on the green chip',
    ).toEqual([true, true, false]);
  });

  it('reuses the same row elements when the page is drawn again', () => {
    // Arrange: page 1 drawn once, its first row noted.
    const parts = createBoardOnThePage();
    const entries = createOverallStandingsEntries();
    drawStandingsPage(parts, layOutStandingsPage(entries, 'table', 1), overallScoreParts, 'offAir');
    const firstRowBefore = listRows(parts)[0];

    // Act: draw it again with the top two swapped, as a live update on air would.
    const swappedEntries = [entries[1], entries[0], ...entries.slice(2)] as StandingsEntry[];
    drawStandingsPage(
      parts,
      layOutStandingsPage(swappedEntries, 'table', 1),
      overallScoreParts,
      'atOnce',
    );

    // Assert: the same element in slot 1, now carrying Equipe FEI Baja.
    const firstRowAfter = listRows(parts)[0];
    expect(firstRowAfter, 'slot 1 must keep its element').toBe(firstRowBefore);
    expect(firstRowAfter?.dataset.carNumber, 'slot 1 now shows car 1').toBe('1');
  });
});

describe('the board in columns', () => {
  it('draws the enduro’s 33 teams as two tables headed PONTOS, with no empty third', () => {
    // Arrange: a board and the enduro's table.
    const parts = createBoardOnThePage();
    const page = layOutStandingsPage(createEnduroStandings().entries, 'columns', 1);

    // Act: draw it.
    drawStandingsPage(parts, page, [], 'offAir');

    // Assert: two tables of 20 and 13, the columns layout marked, the points heading.
    const tables = [...parts.tables.children];
    expect(tables, 'two columns for 33 teams').toHaveLength(2);
    expect(
      tables.map((table) => table.querySelectorAll('[data-testid="standings-row"]').length),
      'the columns hold 20 and 13',
    ).toEqual([20, 13]);
    expect(parts.board.dataset.layout, 'the board is marked as columns').toBe('columns');
    expect(
      [...(tables[0]?.firstElementChild?.children ?? [])].map((caption) => caption.textContent),
      'each column is headed POS, Nº, EQUIPE, PONTOS',
    ).toEqual(['POS', 'Nº', 'EQUIPE', 'PONTOS']);
    expect(
      tables[0] ? readTextsOf(tables[0], 'row-total').slice(0, 3) : [],
      'the points are written in the board’s format',
    ).toEqual(['400', '375', '375']);
  });
});

describe('the head card', () => {
  it('writes the title, the event line and the page line', () => {
    // Arrange: a board.
    const parts = createBoardOnThePage();

    // Act: write the head of page 2 of the overall table.
    writeStandingsHead(
      parts,
      {
        title: 'CLASSIFICAÇÃO GERAL',
        eventLine: '30ª COMPETIÇÃO BAJA SAE BRASIL',
        scoreParts: overallScoreParts,
      },
      '2/3 · 21º A 40º',
    );

    // Assert: the three texts, the event line shown.
    expect(parts.title.textContent, 'the title').toBe('CLASSIFICAÇÃO GERAL');
    expect(parts.eventLine.textContent, 'the event line').toBe('30ª COMPETIÇÃO BAJA SAE BRASIL');
    expect(parts.eventLine.hidden, 'an event line given is shown').toBe(false);
    expect(parts.pageLine.textContent, 'the page line').toBe('2/3 · 21º A 40º');
  });

  it('hides the event line when the item gives none', () => {
    // Arrange: a board.
    const parts = createBoardOnThePage();

    // Act: write a head without an event line.
    writeStandingsHead(
      parts,
      { title: 'CLASSIFICAÇÃO GERAL', eventLine: '', scoreParts: [] },
      '54 EQUIPES',
    );

    // Assert: the event line is hidden, never an empty gap.
    expect(parts.eventLine.hidden, 'an empty event line must be hidden').toBe(true);
  });
});
