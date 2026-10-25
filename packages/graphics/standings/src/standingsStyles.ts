/**
 * The standings' look in Ardósia: the design's `.board`, `.board__head`, `.standings-head`,
 * `.row--standings`, `.standings__columns` and `.standings--columns` rules (PR #21,
 * docs/design/tools/slate-boards.css on slate-base.css) written against the theme's tokens
 * alone. Every colour, size, face, corner and duration is a `var(--token)` the renderer page
 * sets on its :root (packages/theme/ardosia/tokens.css); custom properties reach inside this
 * shadow root. No fallback values, by design: without the theme the board is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 *
 * The board takes the title-safe area: from `--stage-safe-top`, and `--column-right` (the
 * 96 px title-safe margin the tower keeps on the right) on both sides, 1728 px wide. A row
 * is an `<li>` the animations move around the slate pill that holds the cells, so a
 * disqualified team is dimmed through the pill while GSAP owns the `<li>`'s opacity. The
 * grid every pill shares comes from the view as the inline `--standings-columns`. The row
 * pill and its cells are the kit's standingsRowStyles, shared with the intermission's top
 * five (BAJAOVRLAY-46); this file keeps the board, the head, the column heads, the part
 * cells and the columns board's smaller pills.
 */
import { standingsRowStyles } from '@bajaovrlay/graphics-kit/standingsRowStyles';
import { css } from 'lit';

export const standingsStyles = [
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
      /* Every digit the same width, so the points line up down a column. */
      font-variant-numeric: tabular-nums;
      -webkit-font-smoothing: antialiased;
    }

    .card,
    .pill {
      background: var(--panel-base);
      color: var(--text);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    /* The head card: the logo, the title, the event, the page line at the right. */
    .head {
      height: var(--clock-head-height);
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: 0 var(--space-5);
      box-sizing: border-box;
      background: var(--panel-head);
      /* Hidden until playAction animates it in. */
      opacity: 0;
    }

    .logo {
      height: var(--clock-logo-height);
      width: auto;
      flex: none;
    }

    .title {
      margin: 0;
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: var(--size-title);
      letter-spacing: var(--tracking-display);
      text-transform: var(--case-title);
      line-height: 1.3;
      white-space: nowrap;
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

    .event-line {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-left: var(--space-2);
    }

    .page-line {
      flex: none;
      margin-left: auto;
      font-size: var(--size-row);
      color: var(--text-muted);
      white-space: nowrap;
    }

    /* The tables: the overall table alone, or the columns board's three side by side. */
    .board[data-layout='columns'] .tables {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--stack-gap);
      align-items: start;
    }

    /* A column head and its rows, 3 px apart like a tower's. */
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
      padding: 0 var(--row-padding);
      box-sizing: border-box;
    }

    .column-head {
      height: var(--head-height);
      background: var(--panel-head);
      /* Hidden until an animation brings it in. */
      opacity: 0;
    }

    .column-head .caption {
      text-align: right;
      padding-left: var(--space-2);
    }

    .column-head .caption-rank,
    .column-head .caption-car {
      text-align: center;
      padding-left: 0;
    }

    .column-head .caption-team {
      text-align: left;
      padding-left: var(--space-3);
    }

    /* The columns board's pills: the tower's 34 px and 28 px. */
    .board[data-layout='columns'] .row-pill {
      height: var(--row-height);
      font-size: var(--size-row);
    }

    /* One muted column per part of the score, at the detailed tower's size. */
    .cell-part {
      text-align: right;
      font-size: var(--size-detail);
      color: var(--text-muted);
      white-space: nowrap;
    }
  `,
  standingsRowStyles,
];
