/**
 * The plain sponsor roll's look in Ardósia: the theme's card, the sponsor bug's width
 * (--bug-width), and on it the level's heading over one logo. One size, no size field: the
 * card fits the bug's footprint, on a layer just above the bug's. The corner's margins are the theme's
 * safe-area tokens, put on the card by the kit's screenCornerPosition. No fallback values,
 * by design: without the theme the card is unstyled, and packages/theme's
 * noHardCodedValues guard keeps it so.
 *
 * The sponsors' cells sit stacked in one grid cell, so the card is as tall as its tallest
 * cell and never jumps when the sponsor turns; only the cell on air is visible
 * (sponsorRollPlainAnimations.ts).
 */
import { css } from 'lit';

export const sponsorRollPlainStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card in its corner. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .plain-roll-card {
    position: absolute;
    box-sizing: border-box;
    width: var(--bug-width);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction fades it in. */
    opacity: 0;
  }

  /* Every sponsor's cell in the same grid cell: the card keeps one size through the pass. */
  .sponsor-cells {
    display: grid;
  }

  .sponsor-cell {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    min-width: 0;
    /* Hidden until it is the sponsor on air. */
    opacity: 0;
  }

  .level-heading {
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* The logo's strip: the bug mark's height, the logo whole inside it. */
  .sponsor-logo {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    height: var(--bug-logo-height);
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
