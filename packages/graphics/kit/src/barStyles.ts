/**
 * The look both bars along the bottom share (the lower strip, the message ticker; the
 * design's `.lower-strip` and `.lower-strip__page`, PR #19 and #21): the host covering the
 * stage, the bar in the ticker's slot (x 96..1824, bottom at y 1026, 72 px tall) as a grid
 * of the clock block, the bar's pages and the page cell, one column less without the clock
 * block, and the page cell. Written against the theme's tokens alone. A bar's section
 * carries the class `bar`; each graphic adds its own pages' rules after these.
 */
import { css } from 'lit';

export const barStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the bar along the bottom. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .bar {
    position: absolute;
    left: var(--stage-safe-side);
    right: var(--stage-safe-side);
    bottom: var(--stage-safe-bottom);
    height: var(--strip-height);
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--row-gap);
    font-family: var(--font-display);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    font-variant-numeric: tabular-nums;
  }

  /* Without its clock block the bar is its pages and the page cell. */
  .bar[data-clock-block='hidden'] {
    grid-template-columns: 1fr auto;
  }

  /* The page cell at the right: "1/6", muted. */
  .page-cell {
    display: flex;
    align-items: center;
    padding: 0 var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    font-size: var(--size-strip);
    font-weight: var(--weight-number);
    color: var(--text-muted);
  }
`;
