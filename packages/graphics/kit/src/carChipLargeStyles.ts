/**
 * The look of the large car chip, the anchor of the team card and of each podium card: the
 * design's `.chip--large` (docs/design/tools/slate-cards.css) against the theme's tokens,
 * as the team card drew it before it moved here (gate 2 of PR #27). A graphic puts the
 * class `car-chip-large` on the element that shows the car number; nothing else is needed.
 */
import { css } from 'lit';

export const carChipLargeStyles = css`
  .car-chip-large {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--chip-large-size);
    height: var(--chip-large-size);
    /* The face's digits sit high in their line box; the nudge centres their ink. */
    padding-top: var(--glyph-nudge);
    box-sizing: border-box;
    border-radius: var(--radius);
    background: var(--chip-car-background);
    color: var(--chip-car-text);
    font-weight: var(--weight-number);
    font-size: var(--size-chip-large);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
`;
