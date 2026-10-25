/**
 * The bracket's DOM, from the data and the step on screen (packages/graphics/bracket)
 *
 * What this module is for:
 *   bracketView draws the board: the kit's wide head, and on the stage the step on screen,
 *   a round board (roundBoardView.ts) or the tree (bracketTreeView.ts, placed by
 *   treeLayout.ts). Each car shows its chip, team, school and result cell; a bye's empty
 *   slot is the dashed "SEM ADVERSÁRIO" with no chip. These tests render the templates
 *   alone, as Lit draws them, and read the DOM.
 *
 * What these tests prove:
 *   - On a board, each of the six result states of sheet-bracket-results reads as the
 *     sheet shows it, left side then right across the "×": the times, "2 × 1", the
 *     winner's mark and an empty cell, "W.O. × —", "W.O." beside an empty slot with no
 *     chip, "— × —"; each car marked winner, loser or undecided.
 *   - The board's cards come in the round's order, two columns of half the page each.
 *   - The tree's first step draws every round's name, the third place's included, and the
 *     first round's matches only, with no line; the semifinals' step adds their matches and
 *     the lines into them, each line a path through its four points.
 *   - Brackets with no round draw the head alone, nothing on the stage.
 *
 * What these tests deliberately do not cover:
 *   - Motion and what is shown when: bracket.test.ts and bracketAnimations.test.ts.
 *   - Where the pieces really stand in Chromium: e2e/bracketScreenshots.e2e.ts.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { BracketData } from './bracketModel.js';
import { renderBracketTemplate } from './bracketView.js';
import { createResultStatesOnABoard, createTheRealSuperPrime } from './previewData.js';
import type { TreeGeometry } from './treeLayout.js';

/** Ardósia's sizes for the tree, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaTreeGeometry: TreeGeometry = {
  stageWidthPx: 1728,
  stageHeightPx: 900,
  columnGapPx: 96,
  roundNameRoomPx: 40,
  carRowHeightPx: 48,
  carRowGapPx: 3,
};

/** Renders the board of `data` at a step into a fresh element, as the graphic's render does. */
function renderBracketAtStep(data: BracketData, stepIndex: number): HTMLElement {
  const host = document.createElement('div');
  render(renderBracketTemplate({ data, stepIndex, geometry: ardosiaTreeGeometry }), host);
  return host;
}

/** A card side or a tree pill in words: its chip, team, result and outcome ("—" for a bye). */
function describeCar(side: Element): string {
  const chip = side.querySelector('[data-testid="bracket-car-number"]')?.textContent?.trim();
  if (chip === undefined) {
    return side.querySelector('[data-testid="bracket-no-opponent"]')?.textContent?.trim() ?? '?';
  }
  const team = side.querySelector('[data-testid="bracket-team-name"]')?.textContent?.trim();
  const resultCell = side.querySelector<HTMLElement>('[data-testid="bracket-result"]');
  const resultText =
    resultCell?.dataset.resultKind === 'winnerMark' ? '✓' : (resultCell?.textContent?.trim() ?? '');
  return `${String(chip)} ${String(team)} [${resultText}] ${String(side.getAttribute('data-outcome'))}`;
}

describe('a round board', () => {
  it('draws the six result states of sheet-bracket-results, left side across the "×" from the right', () => {
    // Arrange: the six states as one board.
    const host = renderBracketAtStep(createResultStatesOnABoard(), 0);

    // Act: read each card's two sides in words.
    const cards = [...host.querySelectorAll('[data-testid="bracket-match-card"]')].map((card) =>
      [...card.querySelectorAll(':scope > .card-side')].map(describeCar),
    );

    // Assert: each state as the sheet draws it.
    expect(cards, 'every state must read as the sheet shows it').toEqual([
      // Tempo por carro.
      ['32 Corisco [1:11,3] winner', '34 Buffalo [1:14,9] loser'],
      // Melhor de 3.
      ['17 Bombaja [2] winner', '9 Caraubaja [1] loser'],
      // Vitória sem número: the mark beside the winner, nothing beside the loser.
      ['32 Corisco [✓] winner', '34 Buffalo [] loser'],
      // W.O. por ausência: the opponent drawn, dimmed, with "—".
      ['32 Corisco [W.O.] winner', '34 Buffalo [—] loser'],
      // W.O. sem adversário: the empty slot, no chip.
      ['2 Baja UFMG [W.O.] winner', 'SEM ADVERSÁRIO'],
      // Antes de decidir.
      ['32 Corisco [—] undecided', '34 Buffalo [—] undecided'],
    ]);
  });

  it('lays a page of 32 in two columns of 16, in the round’s order', () => {
    // Arrange: the real Super Prime's first board.
    const host = renderBracketAtStep(createTheRealSuperPrime(), 0);

    // Act: read the cards' match ids and the board's rows.
    const board = host.querySelector<HTMLElement>('[data-testid="bracket-round-board"]');
    const matchIds = [
      ...host.querySelectorAll<HTMLElement>('[data-testid="bracket-match-card"]'),
    ].map((card) => card.dataset.matchId);

    // Assert: 16 rows a column (the grid flows down the left column first), r1-m1 to r1-m32.
    expect(board?.style.getPropertyValue('--round-board-rows'), 'two columns of 16').toBe('16');
    expect(matchIds, 'the matches in their order').toEqual(
      Array.from({ length: 32 }, (_unused, index) => `r1-m${String(index + 1)}`),
    );
  });
});

describe('the tree', () => {
  it('draws every round name from its first step, the quarter-finals only, and no line', () => {
    // Arrange: the real Super Prime's fourth step, the tree's first.
    const host = renderBracketAtStep(createTheRealSuperPrime(), 3);

    // Act: read the names, the matches' columns and the lines.
    const names = [...host.querySelectorAll('[data-testid="bracket-round-name"]')].map((name) =>
      name.textContent?.trim(),
    );
    const matchColumns = [
      ...host.querySelectorAll<HTMLElement>('[data-testid="bracket-tree-match"]'),
    ].map((match) => match.dataset.column);
    const lines = host.querySelectorAll('[data-testid="bracket-tree-line"]');

    // Assert: four names, the third place's too; four quarter-finals; no line yet.
    expect(names, 'every round is named from the first step').toEqual([
      'Quartas de final',
      'Semifinal',
      'Final',
      'Disputa de 3º lugar',
    ]);
    expect(matchColumns, 'the quarter-finals alone').toEqual(['0', '0', '0', '0']);
    expect(lines, 'no line runs into a round not shown').toHaveLength(0);
  });

  it('adds the semifinals and the lines into them, each line through its four points', () => {
    // Arrange: the real Super Prime's fifth step.
    const host = renderBracketAtStep(createTheRealSuperPrime(), 4);

    // Act: read the lines.
    const lines = [...host.querySelectorAll<SVGPathElement>('[data-testid="bracket-tree-line"]')];

    // Assert: four lines, into the semifinals; the first from the first quarter-final.
    expect(
      lines.map((line) => line.dataset.intoColumn),
      'four lines into the semifinals',
    ).toEqual(['1', '1', '1', '1']);
    expect(lines[0]?.getAttribute('d'), 'out, across, down, in').toBe(
      'M512 148 L560 148 L560 256 L608 256',
    );
  });
});

describe('brackets with no round', () => {
  it('draws the head alone, nothing on the stage', () => {
    // Arrange: a source with nothing listed yet.
    const host = renderBracketAtStep({ rounds: [] }, 0);

    // Act: read the stage.
    const stage = host.querySelector('[data-testid="bracket-stage"]');

    // Assert: the head is there, the stage empty.
    expect(host.querySelector('[data-testid="bracket-head"]'), 'the head').not.toBeNull();
    expect(stage?.children, 'nothing on the stage').toHaveLength(0);
  });
});
