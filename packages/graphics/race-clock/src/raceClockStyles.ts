/**
 * The race clock's look in Ardósia: the design's `.race-clock` rules (PR #19,
 * docs/design/directions/ardosia) written against the theme's tokens alone. Every
 * colour, size, face, corner and duration is a `var(--token)` the renderer page sets on
 * its :root (packages/theme/ardosia/tokens.css); custom properties reach inside this
 * shadow root. No fallback values, by design: without the theme the clock is unstyled,
 * and packages/theme's noHardCodedValues guard keeps it so.
 *
 * The card is a grid of three fixed rows (head, body, flag band) that never change, so
 * the body cannot grow into the band's room when the band is switched off: the card
 * just gets lower by the band's height (data-flag-band="hidden") and clips the band.
 */
import { css } from 'lit';

export const raceClockStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card in the corner. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* The card: top-right, 420 wide, inside the title-safe area, like the scoreboard. */
  .race-clock-panel {
    position: absolute;
    top: var(--stage-safe-top);
    right: var(--column-right);
    left: var(--column-left);
    width: var(--column-width);
    height: var(--clock-height);
    display: grid;
    grid-template-rows: var(--clock-head-height) var(--clock-body-height) var(--flag-band-height);
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Every digit the same width, so the clock never jitters as it counts. */
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* Without the band the card is head and body only; the band row is clipped away. */
  .race-clock-panel[data-flag-band='hidden'] {
    height: calc(var(--clock-height) - var(--flag-band-height));
  }

  .race-clock-panel[data-flag-band='hidden'] .flag-band {
    visibility: hidden;
    opacity: 0;
  }

  /* The head: the logo at the left, the session title big at the right, denser slate. */
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: 0 var(--space-5);
    background: var(--panel-head);
  }

  .logo {
    height: var(--clock-logo-height);
    width: auto;
    flex: none;
    object-fit: contain;
  }

  .title {
    min-width: 0;
    font-size: var(--size-title);
    font-weight: var(--weight-display);
    letter-spacing: var(--tracking-display);
    text-transform: var(--case-title);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.3;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* The body: the caption line (caption left, laps right) over the time. */
  .body {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'caption laps'
      'time time';
    align-items: center;
    column-gap: var(--space-4);
    /* No bottom padding: the time's line box ends on the body's edge, and the face's
       descender room under the digits is the margin to the band. */
    padding: var(--space-1) var(--space-5) 0;
    overflow: hidden;
  }

  .caption {
    grid-area: caption;
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: left;
    white-space: nowrap;
  }

  .laps {
    grid-area: laps;
    align-self: center;
    font-size: var(--size-row);
    font-weight: var(--weight-number);
    text-transform: uppercase;
    text-align: right;
    white-space: nowrap;
    color: var(--text-laps);
  }

  .time {
    grid-area: time;
    align-self: end;
    font-size: var(--size-time);
    font-weight: var(--weight-display);
    letter-spacing: var(--tracking-time);
    line-height: 1;
  }

  /* The band: two layers, the current one and the incoming one that crossfades over it. */
  .flag-band {
    position: relative;
  }

  .flag-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    padding: 0 var(--space-5);
  }

  .incoming-flag-layer {
    /* Invisible until a flag change fades it in over the current layer. */
    opacity: 0;
  }

  .flag-word {
    padding-top: var(--glyph-nudge);
    font-family: var(--font-display);
    font-weight: var(--weight-number);
    font-size: var(--size-flag);
    letter-spacing: var(--tracking-flag);
    text-transform: uppercase;
    line-height: 1;
    white-space: nowrap;
  }

  .flag-layer[data-flag-state='pre'] {
    background: var(--flag-pre-background);
    color: var(--flag-pre-text);
  }

  .flag-layer[data-flag-state='green'] {
    background: var(--flag-green-background);
    color: var(--flag-green-text);
  }

  .flag-layer[data-flag-state='yellow'] {
    background: var(--flag-yellow-background);
    color: var(--flag-yellow-text);
  }

  .flag-layer[data-flag-state='red'] {
    background: var(--flag-red-background);
    color: var(--flag-red-text);
  }

  /* The checkered band is the pattern alone; the word is only its accessible name. */
  .flag-layer[data-flag-state='checkered'] {
    background: repeating-conic-gradient(
        var(--flag-checkered-dark) 0% 25%,
        var(--flag-checkered-light) 0% 50%
      )
      0 0 / var(--flag-checkered-square) var(--flag-checkered-square);
    color: var(--flag-checkered-text);
  }

  .flag-layer[data-flag-state='finished'] {
    background: var(--flag-finished-background);
    color: var(--flag-finished-text);
  }
`;
