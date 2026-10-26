/**
 * A round board's look in Ardósia (bracket-passo-1 to -3): two columns of 40 px match cards,
 * read down the left column then the right, the gutter wider than the gap between cards;
 * each card the two cars across a "×", chips on the outer edges, results meeting in the
 * middle. The design's `.bracket-board` and `.bracket-fixture*` rules (PR #21,
 * docs/design/tools/slate-boards.css), against the theme's tokens alone. Every card starts
 * hidden (`visibility: hidden` keeps its room); the animations bring it in.
 */
import { css } from 'lit';

export const roundBoardStyles = css`
  .round-board {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: repeat(var(--round-board-rows), auto);
    grid-auto-flow: column;
    gap: var(--stack-gap) var(--bracket-board-gutter);
  }

  .match-card {
    height: var(--board-row-height);
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--bracket-versus-width) minmax(0, 1fr);
    align-items: center;
    padding: 0 var(--space-3);
    box-sizing: border-box;
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    font-size: var(--size-row);
    line-height: 1;
    /* Hidden, keeping its room, until a step brings it in. */
    opacity: 0;
    visibility: hidden;
  }

  .card-side {
    height: 100%;
    display: grid;
    align-items: center;
    column-gap: var(--space-3);
    min-width: 0;
  }

  .card-side[data-side='left'] {
    grid-template-columns: var(--chip-width) minmax(0, 1fr) auto;
  }

  .card-side[data-side='right'] {
    grid-template-columns: auto minmax(0, 1fr) var(--chip-width);
  }

  .card-side[data-side='right'] .team {
    justify-content: flex-end;
  }

  .card-side[data-empty] {
    display: flex;
    justify-content: flex-end;
  }

  .card-side[data-empty] .no-opponent {
    height: var(--chip-height);
    padding: 0 var(--space-3);
    border: var(--bracket-outline-width) dashed var(--bracket-line);
    border-radius: var(--radius-chip);
  }

  .versus {
    text-align: center;
    font-size: var(--size-name);
    line-height: 1;
    color: var(--text-muted);
  }
`;
