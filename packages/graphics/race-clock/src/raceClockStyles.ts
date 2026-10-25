/**
 * The race clock's look in Ardósia: the design's `.race-clock` rules (PR #19,
 * docs/design/directions/ardosia) written against the theme's tokens alone. Every
 * colour, size, face, corner and duration is a `var(--token)` the renderer page sets on
 * its :root (packages/theme/ardosia/tokens.css); custom properties reach inside this
 * shadow root. No fallback values, by design: without the theme the clock is unstyled,
 * and packages/theme's noHardCodedValues guard keeps it so.
 *
 * The card's frame, head and body are the kit's clockCardStyles, which the countdown card
 * shares (BAJAOVRLAY-46). The card is a grid of three fixed rows (head, body, flag band) that never change, so
 * the body cannot grow into the band's room when the band is switched off: the card
 * just gets lower by the band's height (data-flag-band="hidden") and clips the band.
 */
import { clockCardStyles } from '@bajaovrlay/graphics-kit/clockCardStyles';
import { css } from 'lit';

export const raceClockStyles = [
  clockCardStyles,
  css`
    :host {
      /* The graphic covers the whole 1920x1080 stage and places the card in the corner. */
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: none;
    }

    /* The card's frame, head and body are the kit's clockCardStyles (shared with the
     countdown card); the race clock adds its height and its three fixed rows. */
    .race-clock-panel {
      height: var(--clock-height);
      grid-template-rows: var(--clock-head-height) var(--clock-body-height) var(--flag-band-height);
    }

    /* Without the band the card is head and body only; the band row is clipped away. */
    .race-clock-panel[data-flag-band='hidden'] {
      height: calc(var(--clock-height) - var(--flag-band-height));
    }

    .race-clock-panel[data-flag-band='hidden'] .flag-band {
      visibility: hidden;
      opacity: 0;
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
  `,
];
