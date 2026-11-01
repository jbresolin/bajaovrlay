/**
 * The QR card's look in Ardósia: the design's `.qr-card*` rules (PR #21,
 * docs/design/tools/slate-cards.css, with `.card` of slate-base.css) written against the
 * theme's tokens alone. Every colour, size, face, corner and duration is a `var(--token)` the
 * renderer page sets on its :root (packages/theme/ardosia/tokens.css); custom properties
 * reach inside this shadow root. No fallback values, by design: without the theme the card
 * is unstyled, and packages/theme's noHardCodedValues guard keeps it so.
 *
 * The card is the one light surface of the catalogue (`--panel-light`, `--text-on-light`):
 * dark squares on light are what a phone camera reads off a screen. The code's box is
 * `--qr-size`; the code inside is sized in whole px by qrCodeLayout.ts, set inline.
 */
import { css } from 'lit';

export const qrCardStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card in the lower third's slot. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* The card: bottom-left, where the lower third goes. */
  .qr-card {
    position: absolute;
    left: var(--bug-left);
    /* The lower third's bottom edge (y 940, above the strip's room), shared with the team card. */
    bottom: var(--lower-third-bottom);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--panel-light);
    box-shadow: var(--shadow);
    /* As wide as what it holds, never past the lower-third slot's maximum (BAJAOVRLAY-55):
       at the maximum the call to action and the address scroll inside their boxes. */
    max-width: var(--lower-third-max-width);
    box-sizing: border-box;
    color: var(--text-on-light);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md),
       the address too; the code itself encodes the address as typed. */
    text-transform: var(--case-names);
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* The code's box: always --qr-size square, so the card is as tall whatever the address. */
  .code-box {
    flex: none;
    width: var(--qr-size);
    height: var(--qr-size);
  }

  /* The code: its size and place in whole px come inline from the drawing plan. */
  .code {
    display: block;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0 var(--space-3) 0 var(--space-1);
    min-width: 0;
    white-space: nowrap;
  }

  .call-to-action {
    font-weight: var(--weight-display);
    font-size: var(--size-title);
    letter-spacing: var(--tracking-display);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.2;
  }

  .address {
    font-size: var(--size-detail);
    letter-spacing: var(--tracking-caption);
    /* The box clips (a scrolling box): room above and below the line for the accents of a
       caps face, taken back by the margins so the line sits where it always did. */
    padding-block: 0.15em;
    margin-block: -0.15em;
  }
`;
