/**
 * The podium's look in Ardósia: the design's `.board`, `.podium__places`, `.podium-place*`
 * and `.chip--large` rules (PR #21, docs/design/tools/slate-boards.css and slate-cards.css)
 * written against the theme's tokens alone; the head card's look is the kit's
 * boardHeadStyles, which podium.ts adds before these. Every colour, size, face and corner is
 * a `var(--token)` the renderer page sets on its :root (packages/theme/ardosia/tokens.css).
 * No fallback values, by design: without the theme the board is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 *
 * The board takes the title-safe area, x 96..1824 and y 54..1026: the head at the top, the
 * cards standing on the bottom edge, centred, `--space-5` apart. Every card starts hidden
 * (`visibility: hidden` keeps its room); the animations reveal it.
 */
import { css } from 'lit';

export const podiumStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the board in it. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .board {
    position: absolute;
    top: var(--stage-safe-top);
    bottom: var(--stage-safe-bottom);
    left: var(--column-right);
    right: var(--column-right);
    display: flex;
    flex-direction: column;
    gap: var(--stack-gap);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps, through the theme's token. */
    text-transform: var(--case-names);
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
  }

  /* The room under the head; the cards stand on its bottom edge. */
  .stage {
    position: relative;
    flex: 1;
  }

  .cards {
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-end;
    gap: var(--space-5);
  }

  /* A card: its content centred in its height, the winner's card taller. */
  .card {
    width: var(--podium-width);
    min-height: var(--podium-height);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-4);
    text-align: center;
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    /* Hidden, keeping its room, until a step reveals it. */
    opacity: 0;
    visibility: hidden;
  }

  .card[data-slot='first'] {
    min-height: var(--podium-height-winner);
  }

  /* The logo's box: the logo whole inside it, keeping its own shape (the team card's rule). */
  .logo {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: var(--podium-logo-width);
    height: var(--podium-logo-height);
  }

  /* A dark logo, or one on its own white box, sits on the light plate. */
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

  /* The place: yellow text, no field; the 1st on the green chip. */
  .place {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: calc(var(--size-podium-position) + 2 * var(--space-3));
    padding: var(--glyph-nudge) var(--space-4) 0;
    box-sizing: border-box;
    border-radius: var(--radius);
    font-weight: var(--weight-number);
    font-size: var(--size-podium-position);
    line-height: 1;
    color: var(--text-pos);
  }

  .place[data-leader] {
    background: var(--leader-background);
    color: var(--leader-text);
  }

  /* The big chip, as on the team card. */
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
    line-height: 1;
  }

  /* The team: a long name wraps inside the card rather than spill past it. */
  .team-name {
    max-width: 100%;
    font-weight: var(--weight-display);
    font-size: var(--size-name);
    letter-spacing: var(--tracking-display);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.2;
  }

  .school-name {
    font-size: var(--size-detail);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
  }
`;
