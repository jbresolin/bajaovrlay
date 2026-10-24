/**
 * The sponsor bug's look in Ardósia: the design's `.sponsor-bug*` rules (PR #19 and #21,
 * docs/design/tools/slate-base.css and slate-cards.css, with `.card`, `.caption` and
 * `.logo*`) written against the theme's tokens alone. Every colour, size, face, corner and
 * duration is a `var(--token)` the renderer page sets on its :root
 * (packages/theme/ardosia/tokens.css); custom properties reach inside this shadow root.
 * No fallback values, by design: without the theme the bug is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 *
 * The card is the bug's slot (x 96..428 from y 54, `--bug-width` plus its padding): the
 * mark at the left, and beside it a column with the event word over the sponsor cell. The
 * column is centred on the mark's height, so a card with the word alone, or the sponsor
 * alone, looks finished too.
 */
import { css } from 'lit';

export const sponsorBugStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card in the bug's slot. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* The card: top-left, opposite the column. */
  .sponsor-bug {
    position: absolute;
    top: var(--stage-safe-top);
    left: var(--bug-left);
    right: var(--bug-right);
    width: var(--bug-width);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md). */
    text-transform: var(--case-title);
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* The Baja SAE Brasil mark, white on the slate. */
  .mark {
    flex: none;
    display: block;
    height: var(--bug-logo-height);
    width: auto;
    object-fit: contain;
  }

  /* The event word over the sponsor cell. */
  .text-column {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  .event-word {
    font-weight: var(--weight-display);
    font-size: var(--size-bug-label);
    letter-spacing: var(--tracking-display);
    line-height: 1;
    white-space: nowrap;
  }

  /* The sponsor cell: the caption over the logo strip. */
  .sponsor {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    /* The design's 2 px between the caption and the logo, half the smallest space. */
    gap: calc(var(--space-1) / 2);
    min-width: 0;
  }

  .caption {
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
    line-height: 1;
    white-space: nowrap;
  }

  /* The logo's strip: as tall as two caption lines, the logo whole inside it. */
  .sponsor-logo {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    height: var(--sponsor-logo-small-height);
    max-width: 100%;
  }

  /* A dark logo, or one on its own white box, sits on the small light plate. */
  .sponsor-logo.on-light-plate {
    padding: var(--logo-plate-padding);
    border-radius: var(--radius-chip);
    background: var(--panel-light);
  }

  .sponsor-logo-image {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
  }
`;
