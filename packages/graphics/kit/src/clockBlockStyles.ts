/**
 * The clock block's look in Ardósia (clockBlock.ts): the design's `.lower-strip__clock`,
 * `.lower-strip__time` and `.flag-pill` rules (PR #19, docs/design/tools/slate-base.css)
 * written against the theme's tokens alone, with the flag colours of the race clock's band.
 * A graphic adds these to its own styles (`static styles = [clockBlockStyles, ...]`); the
 * block's place in the bar is the graphic's.
 */
import { css } from 'lit';

export const clockBlockStyles = css`
  /* The card: the time and the flag pill, side by side, centred in the bar's height. */
  .clock-block {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: 0 var(--space-5);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
  }

  .clock-block[hidden] {
    display: none;
  }

  .clock-block-time {
    font-family: var(--font-display);
    font-weight: var(--weight-display);
    font-size: var(--size-strip-time);
    letter-spacing: var(--tracking-time);
    /* Every digit the same width: the time never jitters as it counts. */
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
  }

  /* The flag pill: the band's colours on a pill as tall as a caption line. */
  .clock-block-flag {
    display: inline-flex;
    align-items: center;
    height: var(--flag-pill-height);
    /* Content-box, as the design's .flag-pill: the minimum is the word's room, and the
       padding comes on top of it (128 px in all for a short word). */
    min-width: var(--flag-pill-min-width);
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
  }

  .clock-block-flag-word {
    padding-top: var(--glyph-nudge);
    font-family: var(--font-display);
    font-weight: var(--weight-number);
    font-size: var(--size-flag);
    letter-spacing: var(--tracking-flag);
    line-height: 1;
    white-space: nowrap;
  }

  .clock-block-flag[data-flag-state='pre'] {
    background: var(--flag-pre-background);
    color: var(--flag-pre-text);
  }

  .clock-block-flag[data-flag-state='green'] {
    background: var(--flag-green-background);
    color: var(--flag-green-text);
  }

  .clock-block-flag[data-flag-state='yellow'] {
    background: var(--flag-yellow-background);
    color: var(--flag-yellow-text);
  }

  .clock-block-flag[data-flag-state='red'] {
    background: var(--flag-red-background);
    color: var(--flag-red-text);
  }

  /* The checkered pill is the pattern alone; the word is only its accessible name. */
  .clock-block-flag[data-flag-state='checkered'] {
    background: repeating-conic-gradient(
        var(--flag-checkered-dark) 0% 25%,
        var(--flag-checkered-light) 0% 50%
      )
      0 0 / var(--flag-checkered-square) var(--flag-checkered-square);
    color: var(--flag-checkered-text);
  }

  .clock-block-flag[data-flag-state='finished'] {
    background: var(--flag-finished-background);
    color: var(--flag-finished-text);
  }
`;
