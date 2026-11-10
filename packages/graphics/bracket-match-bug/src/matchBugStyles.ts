/**
 * The match bug's look in Ardósia (BAJAOVRLAY-65; no design page yet, so it is built from
 * the catalogue's own parts): the bug's slate card (panel, radius, the display face in
 * caps), the round as a caption over one line of cars, the car's blue chip of the kit
 * (carChipStyles), and the bracket's marks of a result: the winner's chip and result in
 * the leader's green, the loser dimmed like a retired car. Each car's short name sits in
 * a box of the theme's --match-bug-name-width, so the bug keeps its size from match to
 * match and a longer name scrolls inside it (the kit's scrollingTextStyles).
 * Every colour, size and face is a `var(--token)` of packages/theme/ardosia/tokens.css; no
 * fallback values, by design (packages/theme's noHardCodedValues guard keeps it so).
 */
import { css } from 'lit';

export const matchBugStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the bug in its corner. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .match-bug {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-4) var(--space-3);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md). */
    text-transform: var(--case-names);
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction fades it in. */
    opacity: 0;
  }

  /* An empty "agora": nothing to show, so nothing is seen, even while on air. */
  .match-bug[data-has-match='false'] {
    visibility: hidden;
  }

  /* The round over the cars, and the series tag at its right. */
  .round-line {
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

  .round-name {
    flex: 1;
    min-width: 0;
  }

  .series-tag {
    flex: none;
    color: var(--text-pos);
  }

  /* "47 CORISCO 1 × 2 PEQUI 12": one line, car B mirrored on the right. */
  .cars-line {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--size-row);
    font-weight: var(--weight-row);
    letter-spacing: var(--tracking-row);
    line-height: 1.3;
  }

  .car {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .car .chip {
    flex: none;
    font-size: var(--size-row);
  }

  /* A flex box, so car B's name can stand against its chip (below); a box of its own
     width, so the bug keeps its size from match to match. */
  .car-name {
    display: flex;
    width: var(--match-bug-name-width);
  }

  /* Right-aligned while it fits; "safe" puts a name too long for the box at its start, so
     it scrolls like any other instead of overflowing with its start cut off. */
  .car[data-side='b'] .car-name {
    justify-content: safe flex-end;
  }

  .result {
    flex: none;
    font-family: var(--font-display);
    font-weight: var(--weight-number);
    font-variant-numeric: tabular-nums;
  }

  .versus {
    flex: none;
    color: var(--text-muted);
  }

  /* The winner: its chip and its result in the leader's green (the bracket's marks). */
  .car[data-outcome='winner'] .chip {
    background: var(--leader-background);
  }

  .car[data-outcome='winner'] .result {
    color: var(--text-laps);
  }

  /* The loser: dimmed like a retired car. */
  .car[data-outcome='loser'] {
    opacity: var(--status-retired-opacity);
  }
`;
