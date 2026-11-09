/**
 * The Super Chat card's look in Ardósia: the notice's card (noticeStyles.ts, the design's
 * `.notice*` rules of PR #21) with its own rows, written against the theme's tokens alone.
 * The design drew no Super Chat; this card is the notice's frame with what a Super Chat
 * has: "SUPER CHAT" and the amount in the head (the amount in the notice's navy cell,
 * never YouTube's tier colours), the author on the first row, the message on the second.
 * Every colour, size, face, corner and duration is a `var(--token)` the renderer page sets
 * on its :root (packages/theme/ardosia/tokens.css). No fallback values, by design.
 *
 * A viewer's words may hold Unicode emoji, which Bebas Neue does not draw: the author and
 * the message take `--font-emoji` after the theme's face, so the system's colour emoji
 * face draws them and Bebas everything else.
 */
import { css } from 'lit';

export const superChatStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card under the bug. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* The message row is hidden when there is no message; the flex display below would
     otherwise win over the browser's own rule for [hidden]. */
  [hidden] {
    display: none !important;
  }

  /* The card: top-left under the bug, where the notice sits (one layer, one at a time). */
  .super-chat-panel {
    position: absolute;
    top: var(--notice-top);
    left: var(--bug-left);
    width: var(--notice-width);
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md). */
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* The head: what the card is at the left, the amount at the right, denser slate. */
  .head {
    height: var(--notice-head-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0 var(--space-4);
    background: var(--panel-head);
  }

  /* "SUPER CHAT": the notice's badge word, with no field, like a penalty's kind word. */
  .badge {
    display: inline-flex;
    align-items: center;
    padding-top: var(--glyph-nudge);
    font-size: var(--size-flag);
    letter-spacing: var(--tracking-flag);
    line-height: 1;
    white-space: nowrap;
  }

  /* The amount: the notice's one field, a navy cell, as tall as the penalty's. */
  .amount {
    flex: none;
    display: inline-flex;
    align-items: center;
    height: var(--chip-height);
    padding: var(--glyph-nudge) var(--space-3) 0;
    border-radius: var(--radius-chip);
    background: var(--super-chat-amount-background);
    color: var(--super-chat-amount-text);
    font-size: var(--size-row);
    letter-spacing: var(--tracking-row);
    line-height: 1;
    white-space: nowrap;
  }

  /* A row: one text across the card's width. */
  .row {
    height: var(--notice-row-height);
    display: flex;
    align-items: center;
    padding: 0 var(--space-4);
    font-size: var(--size-row);
    line-height: 1;
    white-space: nowrap;
  }

  /* The author and the message: scrolling boxes (the kit's scrollingTextStyles,
     BAJAOVRLAY-55) that take the whole row; a longer text scrolls inside. */
  .author,
  .message {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-text), var(--font-emoji);
    letter-spacing: var(--tracking-row);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height)
       and the taller emoji glyphs. */
    line-height: 1.3;
  }

  /* The message sits under the author, a step quieter, so the name reads first. */
  .message-row {
    padding-bottom: var(--space-1);
  }

  .message {
    color: var(--text-muted);
  }
`;
