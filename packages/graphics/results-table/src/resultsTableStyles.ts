/**
 * The results table's look in Ardósia: the standings board's (standingsStyles.ts, the
 * design's `.board` and `.row--standings`) for the board, its column head and its rows,
 * written against the theme's tokens alone, with no fallback values (packages/theme's
 * noHardCodedValues guard). The row pill and its rank, car and team cells are the kit's
 * standingsRowStyles, which read the grid from `--standings-columns`, written on the board
 * by the view from the measured column widths.
 *
 * Added here: the page's own columns (`.cell-value`, centred, the row's size, each a
 * scrolling box when too long), their captions, the green chip on ranks 1 to 3
 * (`data-medal`, the standings' leader chip), and the hidden box the widths are measured in.
 */
import { standingsRowStyles } from '@bajaovrlay/graphics-kit/standingsRowStyles';
import { css } from 'lit';

export const resultsTableStyles = [
  css`
    :host {
      /* The graphic covers the whole 1920x1080 stage and places the board in it. */
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: none;
    }

    .board {
      position: absolute;
      top: var(--stage-safe-top);
      left: var(--column-right);
      right: var(--column-right);
      display: flex;
      flex-direction: column;
      gap: var(--stack-gap);
      color: var(--text);
      font-family: var(--font-display);
      text-transform: var(--case-rows);
      /* Every digit the same width, so the numbers line up down a column. */
      font-variant-numeric: tabular-nums;
      -webkit-font-smoothing: antialiased;
    }

    .pill {
      background: var(--panel-base);
      color: var(--text);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .caption {
      font-family: var(--font-text);
      font-weight: var(--weight-caption);
      font-size: var(--size-caption);
      letter-spacing: var(--tracking-caption);
      text-transform: uppercase;
      color: var(--text-muted);
      white-space: nowrap;
    }

    /* The column head and its rows, 3 px apart like a tower's. */
    .table,
    .rows {
      display: flex;
      flex-direction: column;
      gap: var(--row-gap);
    }

    .rows {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .column-head {
      display: grid;
      grid-template-columns: var(--standings-columns);
      align-items: center;
      height: var(--head-height);
      padding: 0 var(--row-padding);
      box-sizing: border-box;
      background: var(--panel-head);
      /* Hidden until an animation brings it in. */
      opacity: 0;
    }

    .column-head .caption-rank,
    .column-head .caption-car {
      text-align: center;
    }

    .column-head .caption-team {
      text-align: left;
      padding-left: var(--space-3);
    }

    /* A page column's caption and cells: centred, the same side air, so the measured
       width of the widest is the column's width. Each is a scrolling box (the kit's
       scrollingTextStyles), a block in the grid, when its text is longer than the column. */
    .caption-value,
    .cell-value {
      display: block;
      min-width: 0;
      padding: 0 var(--space-2);
      box-sizing: border-box;
      text-align: center;
      white-space: nowrap;
    }

    /* The row's own size, written on the cell too, so a cell measured outside a row has it. */
    .cell-value {
      font-size: var(--size-board);
      font-weight: var(--weight-row);
      letter-spacing: var(--tracking-row);
      line-height: 1;
    }

    /* The site shows ranks 1 to 3 as medals; here they get the standings' leader chip. */
    .row[data-medal] .cell-rank {
      background: var(--leader-background);
      color: var(--leader-text);
    }

    /* The team's scrolling box fills the team cell (as on the standings). */
    .team-box {
      flex: 1;
      min-width: 0;
    }

    /* Where the column widths are measured: out of sight and out of the flow, each text
       on its own as wide as it needs. */
    .measuring-box {
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      display: flex;
      align-items: flex-start;
    }

    .measuring-box > * {
      display: inline-block;
      flex: none;
    }
  `,
  standingsRowStyles,
];
