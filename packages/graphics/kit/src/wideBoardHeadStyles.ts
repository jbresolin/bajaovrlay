/**
 * The look of a wide board's head card (wideBoardHead.ts) in Ardósia: the design's
 * `.board__head`, `.board__logo`, `.board__title`, `.board__subtitle` and `.board__aside`
 * (docs/design/tools/slate-boards.css), against the theme's tokens alone, as the standings
 * drew it before it moved here. A graphic adds these to its own styles; the head starts
 * invisible, and the graphic's play-in brings it up.
 */
import { css } from 'lit';

export const wideBoardHeadStyles = css`
  /* The head card: the logo, the title, the event, the line at the right. */
  .wide-board-head {
    height: var(--clock-head-height);
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: 0 var(--space-5);
    box-sizing: border-box;
    border-radius: var(--radius);
    background: var(--panel-head);
    box-shadow: var(--shadow);
    color: var(--text);
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  .wide-board-head-logo {
    height: var(--clock-logo-height);
    width: auto;
    flex: none;
  }

  .wide-board-head-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: var(--weight-display);
    font-size: var(--size-title);
    letter-spacing: var(--tracking-display);
    text-transform: var(--case-title);
    line-height: 1.3;
    white-space: nowrap;
  }

  /* The event line, in the caption's look: a scrolling box (scrollingTextStyles) between the
     title and the line at the right, whose text scrolls when too long (BAJAOVRLAY-55). */
  .wide-board-head-event-line {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    padding-left: var(--space-2);
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    text-transform: var(--case-rows);
    color: var(--text-muted);
    white-space: nowrap;
  }

  .wide-board-head-page-line {
    flex: none;
    margin-left: auto;
    font-size: var(--size-row);
    color: var(--text-muted);
    white-space: nowrap;
  }
`;
