/**
 * The team card's look in Ardósia: the design's `.team-card*`, `.chip--large` and `.logo*`
 * rules (PR #21, docs/design/tools/slate-cards.css, with `.card` and `.chip` of
 * slate-base.css) written against the theme's tokens alone. Every colour, size, face,
 * corner and duration is a `var(--token)` the renderer page sets on its :root
 * (packages/theme/ardosia/tokens.css); custom properties reach inside this shadow root.
 * No fallback values, by design: without the theme the card is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 *
 * The card is a row of the cells that exist (photo, text, logo) and takes its width and
 * height from them: without media it is the chip, the name and the school, with the chip as
 * its anchor. Its frame around the text is what teamCardModel's measureTeamCardFrameWidthPx
 * adds up: `--space-3` of padding at each end, and each media cell with a `--space-4` gap.
 */
import { css } from 'lit';

export const teamCardStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card in the lower third's slot. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* The card: bottom-left, where the lower third goes. */
  .team-card {
    position: absolute;
    left: var(--bug-left);
    /* The lower third's bottom edge (y 940, above the strip's room), shared with the lower third. */
    bottom: var(--lower-third-bottom);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md),
       through the theme's token for names, so a theme with a mixed-case face can change it. */
    text-transform: var(--case-names);
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* The car's photo, cropped to fill its box. */
  .photo {
    flex: none;
    display: block;
    width: var(--team-photo-width);
    height: var(--team-photo-height);
    object-fit: cover;
    object-position: center;
    border-radius: var(--radius-chip);
  }

  /* The text block: the chip and the name, then the school and the place line. */
  .identity {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0 var(--space-3) 0 var(--space-2);
    min-width: 0;
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  /* The big chip: the card's anchor. */
  .chip {
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

  .team-name {
    font-weight: var(--weight-display);
    font-size: var(--size-name);
    letter-spacing: var(--tracking-display);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.2;
    white-space: nowrap;
  }

  /* The school and the place line, under the name, lined up with it past the chip. */
  .details {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding-left: calc(var(--chip-large-size) + var(--space-4));
    font-size: var(--size-detail);
    line-height: 1.3;
    white-space: nowrap;
  }

  .details-separator,
  .place-line {
    color: var(--text-muted);
  }

  /* The logo's box: the logo whole inside it, keeping its own shape. */
  .logo {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: var(--team-logo-size);
    height: var(--team-logo-size);
  }

  /* A dark logo, or one on its own white box, sits on the small light plate. */
  .logo.on-light-plate {
    padding: var(--logo-plate-padding);
    border-radius: var(--radius-chip);
    background: var(--panel-light);
  }

  .logo-image {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
  }
`;
