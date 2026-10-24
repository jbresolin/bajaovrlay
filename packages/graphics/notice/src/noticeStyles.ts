/**
 * The notice's look in Ardósia: the design's `.notice*` rules (PR #21,
 * docs/design/tools/slate-cards.css, with `.card`, `.caption` and `.chip` of
 * slate-base.css) written against the theme's tokens alone. Every colour, size, face,
 * corner and duration is a `var(--token)` the renderer page sets on its :root
 * (packages/theme/ardosia/tokens.css); custom properties reach inside this shadow root.
 * No fallback values, by design: without the theme the notice is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 *
 * The card is a head over one or two rows and takes its height from them: a notice
 * without a reason row is simply shorter. It never carries a coloured band, so it cannot
 * be read as the clock's flag band.
 */
import { css } from 'lit';

export const noticeStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card under the bug. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* A part the variant or the data has no use for is hidden; the flex and grid display
     values below would otherwise win over the browser's own rule for [hidden]. */
  [hidden] {
    display: none !important;
  }

  /* The card: top-left under the bug, the clock's width, mirrored to the left. */
  .notice-panel {
    position: absolute;
    top: var(--notice-top);
    left: var(--bug-left);
    width: var(--notice-width);
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md). */
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* The head: the badge at the left, the caption at the right, denser slate. */
  .head {
    height: var(--notice-head-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0 var(--space-4);
    background: var(--panel-head);
  }

  /* The badge: 32 px of the 48 px head (a space-2 margin above and below), plus the glyph
     nudge on top, as the design draws it (its content box is the 32 px). */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: calc(var(--notice-head-height) - 2 * var(--space-2));
    padding: var(--glyph-nudge) var(--space-3) 0;
    border-radius: var(--radius-chip);
    font-size: var(--size-flag);
    letter-spacing: var(--tracking-flag);
    line-height: 1;
    white-space: nowrap;
  }

  /* The fastest lap's badge is the one green field besides the leader chip. */
  .best-lap-badge {
    background: var(--leader-background);
    color: var(--leader-text);
  }

  /* A penalty's badge has no field: the warning shape and the word carry it. */
  .warning-badge {
    padding-left: 0;
    color: var(--text);
  }

  /* The triangle, a step larger than a status icon so it stands beside the 26 px word. */
  .warning-icon {
    flex: none;
    display: block;
    width: calc(var(--status-icon-size) + var(--space-1));
    height: calc(var(--status-icon-size) + var(--space-1));
    margin-top: calc(-1 * var(--glyph-nudge));
  }

  .caption {
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* A row: the chip, the team, and at the right the lap time or the penalty cell. */
  .row {
    height: var(--notice-row-height);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-4);
    font-size: var(--size-row);
    line-height: 1;
    white-space: nowrap;
  }

  .chip {
    flex: none;
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
    font-size: var(--size-row);
  }

  .team {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    overflow: hidden;
  }

  .team-name {
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: var(--tracking-row);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.3;
  }

  .school-name {
    flex: none;
    font-size: var(--size-caption);
    color: var(--text-muted);
  }

  .lap-time {
    flex: none;
    margin-left: auto;
    padding-top: var(--glyph-nudge);
    font-size: var(--size-name);
    letter-spacing: var(--tracking-time);
    color: var(--text-laps);
  }

  /* The reason row wraps: a long reason pushes the penalty cell to a second line,
     right-aligned, rather than being cut short. */
  .reason-row {
    height: auto;
    min-height: var(--notice-row-height);
    box-sizing: border-box;
    flex-wrap: wrap;
    row-gap: var(--space-2);
    padding-top: var(--space-3);
    padding-bottom: var(--space-3);
  }

  .reason {
    flex: 1 0 auto;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: var(--tracking-row);
    line-height: 1.3;
  }

  /* The penalty: a brand-navy cell, the one field a notice uses; navy is no flag colour. */
  .penalty {
    flex: none;
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    height: var(--chip-height);
    padding: var(--glyph-nudge) var(--space-3) 0;
    border-radius: var(--radius-chip);
    background: var(--notice-penalty-background);
    color: var(--notice-penalty-text);
  }
`;
