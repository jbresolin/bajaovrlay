/**
 * What the intermission board shows, in all four combinations of its optional parts
 * (packages/graphics/intermission-board)
 *
 * What this module is for:
 *   intermissionBoardView.ts draws the board: the head ("INTERVALO"), the next-session card,
 *   the top five and the sponsor line. The top five and the sponsor line are each optional
 *   (BAJAOVRLAY-46): without the top five the next session takes the whole width, its words
 *   centred; without sponsors there is no line (the design's four motion demos).
 *
 * What these tests prove (a table of the four combinations):
 *   - With and without the top five, with and without sponsors: which parts are drawn and
 *     whether the body is one column.
 *   - The next card's words, and the top five's rows: rank, car, team, school, the points
 *     as the boards write them, the leader on the green chip.
 *   - The sponsor line's first page: its level's heading and up to four logos.
 *
 * What these tests deliberately do not cover:
 *   - The look; the screenshots. The turns and the count; intermission-board.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  createBreakBeforeTheEnduro,
  createIntermissionBoardOnThePage,
  isPartDrawn,
  loadIntermissionBoardWithData,
  readShownText,
  readSponsorLineShown,
} from './intermissionBoardOnThePage.testSupport.js';

const combinations = [
  // The design's page: everything.
  {
    name: 'draws the top five beside the next session, and the sponsor line',
    parts: { hasTopFive: true, hasSponsors: true },
    expected: { hasTopFive: true, hasSponsorLine: true, isOneColumn: false },
  },
  // No sponsor to show: no line.
  {
    name: 'draws no sponsor line without sponsors',
    parts: { hasTopFive: true, hasSponsors: false },
    expected: { hasTopFive: true, hasSponsorLine: false, isOneColumn: false },
  },
  // Before the first standings exist: the next session across the width.
  {
    name: 'puts the next session across the width without the top five',
    parts: { hasTopFive: false, hasSponsors: true },
    expected: { hasTopFive: false, hasSponsorLine: true, isOneColumn: true },
  },
  // Neither: the next session alone.
  {
    name: 'draws the next session alone without either part',
    parts: { hasTopFive: false, hasSponsors: false },
    expected: { hasTopFive: false, hasSponsorLine: false, isOneColumn: true },
  },
];

describe('the four combinations of the optional parts', () => {
  it.each(combinations)('$name', async ({ parts, expected }) => {
    // Arrange: a board on the page.
    const board = createIntermissionBoardOnThePage();

    // Act: load the break with the parts of this row.
    await loadIntermissionBoardWithData(board, createBreakBeforeTheEnduro(parts));

    // Assert: the parts drawn, and the body's columns.
    const body = board.shadowRoot?.querySelector('[data-testid="intermission-body"]');
    expect(
      {
        hasTopFive: isPartDrawn(board, 'intermission-top-five'),
        hasSponsorLine: isPartDrawn(board, 'intermission-sponsor-line'),
        isOneColumn: body?.classList.contains('single'),
      },
      'what the board is made of',
    ).toEqual(expected);
    expect(readShownText(board, 'intermission-session'), 'the next session always').toBe(
      'Enduro de Resistência',
    );
  });
});

describe('the parts', () => {
  it('writes the next card and the top five as the design does', async () => {
    // Arrange: a board on the page.
    const board = createIntermissionBoardOnThePage();

    // Act: load the full break.
    await loadIntermissionBoardWithData(
      board,
      createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: true }),
    );

    // Assert: the start, the top five's head and its first row, the leader on the chip.
    expect(readShownText(board, 'intermission-start'), 'the start').toBe('LARGADA ÀS 10:00');
    expect(readShownText(board, 'intermission-top-head')?.trim(), 'the top five’s head').toBe(
      'CLASSIFICAÇÃO GERAL · 5 PRIMEIROS',
    );
    const rows = [
      ...(board.shadowRoot?.querySelectorAll<HTMLElement>('[data-testid="intermission-row"]') ??
        []),
    ];
    const firstRowCells = [...(rows[0]?.querySelectorAll('.row-pill > span') ?? [])].map(
      (cell) => cell.textContent,
    );
    expect(firstRowCells, 'Baja UFMG first').toEqual(['1', '2', 'Baja UFMGUFMG', '921,8']);
    expect(
      rows.map((row) => row.hasAttribute('data-leader')),
      'the leader alone',
    ).toEqual([true, false, false, false, false]);
  });

  it('opens the sponsor line on its first page: Diamante, Bosch and Renault', async () => {
    // Arrange: a board on the page.
    const board = createIntermissionBoardOnThePage();

    // Act: load the full break.
    await loadIntermissionBoardWithData(
      board,
      createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: true }),
    );

    // Assert: the first page of the round.
    expect(readSponsorLineShown(board), 'the line’s first page').toEqual({
      heading: 'PATROCÍNIO DIAMANTE',
      names: ['Bosch', 'Renault'],
    });
  });
});
