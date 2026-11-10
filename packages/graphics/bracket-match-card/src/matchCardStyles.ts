/**
 * The "a seguir" card's look in Ardósia (BAJAOVRLAY-65; no design page yet, so it is built
 * from the catalogue's own parts): the team card's slate panel in the lower third's slot,
 * as wide as the lower third may be (--lower-third-max-width), so it keeps its size from
 * match to match; the head line in the caption face, "A SEGUIR" in the position's yellow;
 * each side the team card's logo cell (teamLogoCellStyles, a --team-logo-size square) or
 * its large chip (carChipLargeStyles), then the name at the lower third's size over the
 * details caption. Every colour, size and face is a `var(--token)` of
 * packages/theme/ardosia/tokens.css; no fallback values, by design.
 */
import { css } from 'lit';

export const matchCardStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the card in the lower third. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
    /* The kit's logo cell (teamLogoCellStyles.ts): the team card's square box. */
    --team-logo-cell-width: var(--team-logo-size);
    --team-logo-cell-height: var(--team-logo-size);
  }

  /* The card: bottom-left, where the lower third goes, the lower third's widest. */
  .match-card {
    position: absolute;
    left: var(--bug-left);
    bottom: var(--lower-third-bottom);
    width: var(--lower-third-max-width);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md). */
    text-transform: var(--case-names);
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* An empty "a seguir": nothing to show, so nothing is seen, even while on air. */
  .match-card[data-has-match='false'] {
    visibility: hidden;
  }

  .head-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
  }

  .up-next-word,
  .series-tag {
    color: var(--text-pos);
  }

  /* The two sides take the same width; the middle keeps its own. */
  .sides {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-4);
  }

  .side {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }

  /* Car B mirrored: its logo or chip at the right edge, its words right-aligned. */
  .side[data-side='b'] {
    flex-direction: row-reverse;
  }

  .identity {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-width: 0;
  }

  .side[data-side='b'] .identity {
    align-items: flex-end;
  }

  .team-name {
    display: flex;
    max-width: 100%;
    font-size: var(--size-name);
    letter-spacing: var(--tracking-display);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.15;
  }

  .details {
    display: flex;
    max-width: 100%;
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
  }

  /* Right-aligned while it fits; "safe" puts a line too long for the box at its start, so
     it scrolls like any other instead of overflowing with its start cut off. */
  .side[data-side='b'] .team-name,
  .side[data-side='b'] .details {
    justify-content: safe flex-end;
  }

  .middle {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    font-size: var(--size-name);
    font-variant-numeric: tabular-nums;
  }

  .versus {
    color: var(--text-muted);
  }
`;
