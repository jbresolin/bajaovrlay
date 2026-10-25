/**
 * The sessions board's look in Ardósia: the kit's narrowBoardStyles (the frame and the head
 * card) with the design's `.session-row`, `__time`, `__name` and `__status` rules (PR #21,
 * docs/design/tools/slate-boards.css), against the theme's tokens alone. A row's slate is
 * drawn by two layers behind its content (the base slate, and the denser one of the slot in
 * progress) and its state by three stacked layers, so a change of state crossfades in
 * place; which layer shows is the animations' (inline opacity), never a class swap. No
 * fallback values, by design: without the theme the board is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 */
import { narrowBoardStyles } from '@bajaovrlay/graphics-kit/boardStyles';
import { css } from 'lit';

export const sessionsBoardStyles = [
  narrowBoardStyles,
  css`
    .rows {
      display: flex;
      flex-direction: column;
      gap: var(--row-gap);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* The list item holds its pill and nothing else; the pill is what moves. */
    .row-place {
      display: block;
    }

    /* One pill per slot: the time big at the left, the session, the state at the right. */
    .session-row {
      position: relative;
      height: var(--session-row-height);
      display: grid;
      grid-template-columns: var(--session-time-width) 1fr auto;
      align-items: center;
      column-gap: var(--space-4);
      padding: 0 var(--space-5);
      color: var(--text);
      /* Hidden until playAction animates it in. */
      opacity: 0;
    }

    /* The two slates behind the content: the base one, the denser one in progress. */
    .slate {
      position: absolute;
      inset: 0;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .base-slate {
      background: var(--panel-base);
    }

    .live-slate {
      background: var(--panel-head);
      opacity: 0;
    }

    .session-time,
    .session-name,
    .session-status {
      position: relative;
    }

    .session-time {
      font-size: var(--size-name);
      letter-spacing: var(--tracking-time);
      line-height: 1;
      padding-top: var(--glyph-nudge);
    }

    .session-name {
      font-size: var(--size-title);
      letter-spacing: var(--tracking-display);
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* The three state layers stacked in one cell, right-aligned, one visible. */
    .session-status {
      display: grid;
      justify-items: end;
    }

    .status-layer {
      grid-area: 1 / 1;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--size-flag);
      letter-spacing: var(--tracking-flag);
      line-height: 1;
      padding-top: var(--glyph-nudge);
      white-space: nowrap;
      opacity: 0;
    }

    .status-icon {
      width: var(--session-status-icon-size);
      height: var(--session-status-icon-size);
      margin-top: calc(-1 * var(--glyph-nudge));
    }

    /* Each layer carries its own state, so the old and the new crossfade in their colours. */
    .status-layer[data-status='finished'] {
      color: var(--text-muted);
    }

    .status-layer[data-status='inProgress'] {
      color: var(--text-laps);
    }

    .status-layer[data-status='upcoming'] {
      color: var(--text);
    }
  `,
];
