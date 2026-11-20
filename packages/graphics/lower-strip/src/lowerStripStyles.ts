/**
 * The lower strip's look in Ardósia: the design's `.lower-strip*` and `.strip-car*` rules
 * (PR #19, docs/design/tools/slate-base.css, with `.card`, `.pill` and `.chip`) written
 * against the theme's tokens alone; the clock block's look is the kit's
 * (clockBlockStyles), and the bar, its no-clock variant and the page cell are the kit's
 * barStyles. Every colour, size, face, corner and duration is a `var(--token)`
 * the renderer page sets on its :root (packages/theme/ardosia/tokens.css). No fallback
 * values, by design: without the theme the bar is unstyled, and packages/theme's
 * noHardCodedValues guard keeps it so.
 *
 * The bar is the ticker layer's slot along the bottom (x 96..1824, y 954..1026): the clock
 * block, the pages box and the page cell in a grid; without the block the pages start at
 * the left. Each car pill is as wide as its school name and the pills share what is left
 * (flex: 1 1 auto), as the design draws them; the two lanes lie on top of each other.
 */
import { barStyles } from '@bajaovrlay/graphics-kit/barStyles';
import { clockBlockStyles } from '@bajaovrlay/graphics-kit/clockBlockStyles';
import { css } from 'lit';

const lowerStripOwnStyles = css`
  .pages {
    position: relative;
    min-width: 0;
  }

  /* The two lanes lie on top of each other; a page turn moves both at once. */
  .cars {
    position: absolute;
    inset: 0;
    display: flex;
    gap: var(--row-gap);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* A car pill: the position, the car chip and the school, as wide as its name; then the
     laps and the gap when the item shows them (BAJAOVRLAY-81), each in a column of its own
     placed after the school (the column flow keeps them on the one row), as wide as its
     words. A hidden cell takes no column, so a plain pill is exactly as before. */
  .car {
    flex: 1 1 auto;
    min-width: 0;
    display: grid;
    grid-template-columns: var(--column-pos) var(--chip-width) 1fr;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    column-gap: var(--space-2);
    padding: 0 var(--space-3);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    font-size: var(--size-strip);
    font-weight: var(--weight-row);
    text-transform: var(--case-rows);
    line-height: 1;
  }

  /* The position in yellow, with its ordinal sign; the leader's on the green chip. */
  .position {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--chip-height);
    padding-top: var(--glyph-nudge);
    box-sizing: border-box;
    border-radius: var(--radius-chip);
    font-weight: var(--weight-number);
    color: var(--text-pos);
  }

  .car[data-leader] .position {
    background: var(--leader-background);
    color: var(--leader-text);
  }

  /* The car number: the blue chip. */
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--chip-width);
    height: var(--chip-height);
    /* The face's digits sit high in their line box; the nudge centres their ink. */
    padding-top: var(--glyph-nudge);
    box-sizing: border-box;
    border-radius: var(--radius-chip);
    background: var(--chip-car-background);
    color: var(--chip-car-text);
    font-weight: var(--weight-number);
    font-size: var(--size-strip);
  }

  /* The laps in the tower's laps green, the gap muted, both at the strip's size: the
     cars a page drop instead (stripPages.ts), so no text is ever shrunk to fit. */
  /* The same line box as the school's, so the three texts share one baseline. */
  .laps,
  .gap {
    line-height: 1.3;
    font-weight: var(--weight-number);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-row);
    white-space: nowrap;
  }

  .laps {
    color: var(--text-laps);
  }

  .gap {
    color: var(--text-muted);
  }

  .laps[hidden],
  .gap[hidden] {
    display: none;
  }

  /* The school's short name, whole: six cars a page always fit (stripPages.ts). A name
     too long scrolls inside its box (a scrolling box, BAJAOVRLAY-55), bounded by the theme
     so the other pills of its page keep their room and stay whole. */
  .school {
    max-width: var(--strip-school-max-width);
    white-space: nowrap;
    overflow: hidden;
    padding-left: var(--space-1);
    letter-spacing: var(--tracking-row);
    line-height: 1.3;
  }
`;

export const lowerStripStyles = [barStyles, clockBlockStyles, lowerStripOwnStyles];
