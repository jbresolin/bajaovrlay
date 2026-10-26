/**
 * The frame of a wide full-screen board (the podium, the bracket): the host covering the
 * 1920x1080 stage, the board on the title-safe area (x 96..1824, y 54..1026) as a column
 * of the head and the stage under it, and the stage itself, the room the graphic fills.
 * The design's `.board` (docs/design/tools/slate-boards.css), against the theme's tokens
 * alone; moved here when the bracket was its second copy (gate 2 of PR #30). A graphic adds
 * its own rules to its host or stage after these.
 */
import { css } from 'lit';

export const wideBoardFrameStyles = css`
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
    bottom: var(--stage-safe-bottom);
    left: var(--column-right);
    right: var(--column-right);
    display: flex;
    flex-direction: column;
    gap: var(--stack-gap);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps, through the theme's token. */
    text-transform: var(--case-names);
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
  }

  /* The room under the head, which the graphic fills. */
  .stage {
    position: relative;
    flex: 1;
  }
`;
