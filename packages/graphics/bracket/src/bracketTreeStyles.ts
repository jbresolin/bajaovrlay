/**
 * The tree's look in Ardósia (bracket-passo-4 to -7): the round name pills, the matches as
 * two stacked 48 px car pills, the connecting lines, and the bye's dashed slot. The design's
 * `.bracket__*` and `.bracket-car*` rules (PR #21, docs/design/tools/slate-boards.css),
 * against the theme's tokens alone. Every piece is placed by its inline style
 * (treeLayout.ts), and starts hidden; the animations bring it in.
 */
import { css } from 'lit';

export const bracketTreeStyles = css`
  .tree {
    position: absolute;
    inset: 0;
  }

  .tree-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .tree-lines path {
    fill: none;
    stroke: var(--bracket-line);
    stroke-width: var(--bracket-line-width);
    opacity: 0;
    visibility: hidden;
  }

  /* A round's name: the head slate's pill, the caption centred. */
  .round-name {
    position: absolute;
    top: 0;
    height: var(--head-height);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius);
    background: var(--panel-head);
    box-shadow: var(--shadow);
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
  }

  .tree-match {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: var(--row-gap);
  }

  /* The slot is what rises in; the pill inside it carries the loser's dimming. */
  .tree-car-slot {
    opacity: 0;
    visibility: hidden;
  }

  .tree-car {
    height: var(--bracket-row-height);
    display: grid;
    grid-template-columns: var(--chip-width) minmax(0, 1fr) auto;
    align-items: center;
    column-gap: var(--space-3);
    padding: 0 var(--space-4);
    box-sizing: border-box;
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    font-size: var(--size-row);
    line-height: 1;
  }

  .tree-car[data-empty] {
    grid-template-columns: 1fr;
    background: none;
    box-shadow: none;
    border: var(--bracket-outline-width) dashed var(--bracket-line);
  }
`;
