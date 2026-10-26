/**
 * The car's chip: the tower's blue square with the car number, the face's high-sitting
 * digits nudged to the centre (the design's `.chip`, docs/design/tools/slate-base.css),
 * against the theme's tokens alone. Moved here at its sixth copy (gate 2 of PR #30): the
 * standings row and the bracket use it; the tower, the strip, the battle card and the
 * notice keep theirs until they move. The chip takes its text size from where it sits.
 */
import { css } from 'lit';

export const carChipStyles = css`
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--chip-width);
    height: var(--chip-height);
    padding-top: var(--glyph-nudge);
    box-sizing: border-box;
    border-radius: var(--radius-chip);
    background: var(--chip-car-background);
    color: var(--chip-car-text);
    font-family: var(--font-display);
    font-weight: var(--weight-number);
    line-height: 1;
  }
`;
