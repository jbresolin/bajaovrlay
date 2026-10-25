/**
 * The intermission board's look in Ardósia: the kit's narrowBoardStyles (the frame and the
 * head card) and standingsRowStyles (the top five's pills, the standings' own), with the
 * design's `.intermission__body`, `__next`, `__session`, `__countdown`, `__start`,
 * `__top-head`, `__sponsors` and `__sponsor` rules (PR #21, docs/design/tools/
 * slate-boards.css), against the theme's tokens alone. Without the top five the body is one
 * column and the next session's words are centred. The sponsor line's two layers are
 * stacked in one place, so a page turns in place. No fallback values, by design: without
 * the theme the board is unstyled, and packages/theme's noHardCodedValues guard keeps it so.
 */
import { narrowBoardStyles } from '@bajaovrlay/graphics-kit/boardStyles';
import { standingsRowStyles } from '@bajaovrlay/graphics-kit/standingsRowStyles';
import { css } from 'lit';

export const intermissionBoardStyles = [
  narrowBoardStyles,
  standingsRowStyles,
  css`
    /* An element's wrapper has no box of its own (intermissionBoardView.ts says why). */
    .piece-place {
      display: contents;
    }

    /* The next session beside the top five, or alone across the width. */
    .intermission-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--stack-gap);
      align-items: stretch;
    }

    .intermission-body.single {
      grid-template-columns: 1fr;
    }

    .next-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-5);
      /* Hidden until playAction animates it in. */
      opacity: 0;
    }

    .intermission-body.single .next-card {
      align-items: center;
      text-align: center;
    }

    .next-session {
      font-size: var(--size-time);
      letter-spacing: var(--tracking-display);
      line-height: 1.2;
      white-space: nowrap;
    }

    .next-count {
      font-size: var(--size-countdown-small);
      letter-spacing: var(--tracking-time);
      line-height: 1;
      padding-top: var(--space-2);
    }

    .next-start {
      font-size: var(--size-title);
      letter-spacing: var(--tracking-display);
      color: var(--text-muted);
    }

    /* The top five: the standings' pills with the rank, the car, the team and the points. */
    .top-five {
      --standings-columns: var(--column-pos) var(--chip-width) minmax(0, 1fr) var(--col-points);
      display: flex;
      flex-direction: column;
      gap: var(--row-gap);
    }

    .top-head {
      height: var(--head-height);
      display: flex;
      align-items: center;
      padding: 0 var(--row-padding) 0 var(--space-4);
      opacity: 0;
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: var(--row-gap);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* The sponsor line: a level's heading and up to four logos, two layers in one place. */
    .sponsor-line {
      display: grid;
      padding: var(--space-3) var(--space-5);
      opacity: 0;
    }

    .line-layer {
      grid-area: 1 / 1;
      display: flex;
      align-items: center;
      gap: var(--space-5);
    }

    /* The heading has one width on every page, so the logos start at the same place. */
    .line-heading {
      flex: none;
      width: var(--sponsor-line-heading-width);
    }

    .line-logo {
      flex: none;
      width: var(--sponsor-logo-line-width);
      height: var(--sponsor-logo-line-height);
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }

    .line-logo.on-light-plate {
      padding: var(--logo-plate-padding);
      border-radius: var(--radius-chip);
      background: var(--panel-light);
    }

    .logo-image {
      display: block;
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
    }
  `,
];
