/**
 * The battle card's look in Ardósia: the design's `.battle-card`, `.battle-car*` and
 * `.battle-gap*` rules (PR #21, docs/design/tools/slate-cards.css, with `.pill`, `.card`,
 * `.chip` and `.row__pos` of slate-base.css) written against the theme's tokens alone.
 * Every colour, size, face, corner and duration is a `var(--token)` the renderer page sets
 * on its :root (packages/theme/ardosia/tokens.css); custom properties reach inside this
 * shadow root. No fallback values, by design: without the theme the card is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 *
 * The trend's shape is as tall as the tower's ▲ / ▼ cue (`--cue-height`, the design's
 * 10 px) and as wide as its 24 × 10 view box makes it, so it needs no size of its own.
 */
import { css } from 'lit';

export const battleCardStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card bottom-centre. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* Bottom-centre, its bottom edge on the lower third's (y 940), so the lower third's slot
     at the left and the column at the right stay free. */
  .battle-card {
    position: absolute;
    left: 50%;
    bottom: var(--lower-third-bottom);
    transform: translateX(-50%);
    /* As wide as the pieces want: placed at left 50%, the card would otherwise be offered
       half the stage and squeeze the team columns, which may shrink since BAJAOVRLAY-55.
       Each team column stops at --battle-team-max-width instead. */
    width: max-content;
    display: flex;
    align-items: stretch;
    gap: var(--row-gap);
    color: var(--text);
    font-family: var(--font-display);
    font-variant-numeric: tabular-nums;
    text-transform: var(--case-names);
    -webkit-font-smoothing: antialiased;
  }

  .pill,
  .card {
    position: relative;
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    /* Hidden until playAction animates each piece in. */
    opacity: 0;
  }

  /* One car: position, chip, team over school, laps, at the strip's 30 px. */
  .battle-car {
    height: var(--battle-height);
    display: grid;
    grid-template-columns: var(--column-pos) var(--chip-width) auto auto;
    align-items: center;
    column-gap: var(--space-3);
    padding: 0 var(--space-4);
    font-size: var(--size-strip);
    line-height: 1;
  }

  .position {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--chip-height);
    padding-top: var(--glyph-nudge);
    box-sizing: border-box;
    border-radius: var(--radius-chip);
    font-weight: var(--weight-number);
    /* Yellow text, no field (the design's --chip-pos-background is transparent). */
    color: var(--text-pos);
  }

  /* The leader's position becomes the green chip, as on the tower. */
  .battle-car[data-leader] .position {
    background: var(--leader-background);
    color: var(--leader-text);
  }

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
    line-height: 1;
  }

  /* The team over the school: as wide as the longer line, never past the theme's
     maximum (BAJAOVRLAY-55), so two cars and the gap card stay inside the title-safe
     area; past it each line scrolls inside its box (the kit's scrollingTextStyles). */
  .team {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-1) / 2);
    padding: 0 var(--space-2);
    max-width: var(--battle-team-max-width);
    min-width: 0;
    white-space: nowrap;
  }

  .team-name {
    letter-spacing: var(--tracking-row);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.2;
  }

  .school-name {
    font-size: var(--size-caption);
    color: var(--text-muted);
    /* The box clips (a scrolling box): room above and below the line for the accents of a
       caps face, taken back by the margins so the line sits where it always did. */
    padding-block: 0.15em;
    margin-block: -0.15em;
  }

  .laps {
    color: var(--text-laps);
    padding-left: var(--space-3);
    white-space: nowrap;
  }

  /* The gap card between the cars: the gap at 44 px over the trend. */
  .gap-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    /* The design's content box: the padding comes on top of the 220 px. */
    min-width: var(--battle-gap-width);
    padding: 0 var(--space-4);
  }

  .gap {
    font-size: var(--size-name);
    letter-spacing: var(--tracking-time);
    line-height: 1;
    padding-top: var(--glyph-nudge);
  }

  /* The trend cell's two layers share one place, so a crossfade never moves anything. */
  .trend-stack {
    display: grid;
  }

  .trend {
    grid-area: 1 / 1;
    justify-self: center;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--size-flag);
    letter-spacing: var(--tracking-caption);
    line-height: 1;
    white-space: nowrap;
  }

  /* The incoming layer waits invisible until a change of word crossfades it in. */
  .trend.incoming {
    opacity: 0;
  }

  .trend-shape {
    height: var(--cue-height);
    width: auto;
    margin-top: calc(-1 * var(--glyph-nudge));
  }

  /* Each layer carries its own trend, so the old and the new crossfade in their colours. */
  .trend[data-trend='closing'] {
    color: var(--text-laps);
  }

  .trend[data-trend='opening'] {
    color: var(--cue-down-text);
  }

  .trend[data-trend='steady'] {
    color: var(--text-muted);
  }
`;
