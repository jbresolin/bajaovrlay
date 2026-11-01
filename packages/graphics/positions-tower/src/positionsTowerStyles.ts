/**
 * The positions tower's look in Ardósia: the design's `.tower*`, `.row*`, `.compact-head`,
 * `.detail-head`, `.chip`, `.status-icon`, `.cue` and `.is-up` / `.is-down` rules (PR #19,
 * docs/design/directions/ardosia, slate-base.css) written against the theme's tokens
 * alone. Every colour, size, face, corner and duration is a `var(--token)` the renderer
 * page sets on its :root (packages/theme/ardosia/tokens.css); custom properties reach
 * inside this shadow root. No fallback values, by design: without the theme the tower is
 * unstyled, and packages/theme's noHardCodedValues guard keeps it so.
 *
 * A row is an `<li>` the animations move (opacity, transform; out of flow while it lifts
 * away) around the slate pill that holds the cells. The two are separate so a car out of
 * the race can be dimmed through the pill while GSAP owns the `<li>`'s opacity.
 *
 * The compact grid is fixed here; the detailed grid and width come from the view as the
 * inline custom properties `--detail-columns` and `--tower-width` (towerColumns.ts), so a
 * column turned off takes its width with it.
 */
import { css } from 'lit';

export const positionsTowerStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the tower in the column. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* The tower: under the clock, on the right-hand column, 420 wide when compact. */
  .tower {
    position: absolute;
    top: var(--tower-top);
    right: var(--column-right);
    left: var(--column-left);
    width: var(--column-width);
    color: var(--text);
    font-family: var(--font-display);
    /* Every digit the same width, so gaps and laps never jitter as they change. */
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
  }

  /* The detailed tower is as wide as the columns it shows (set by the view). */
  .tower[data-layout='detailed'] {
    width: var(--tower-width);
  }

  .pill {
    background: var(--panel-base);
    color: var(--text);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  /* The head pill: denser slate, the column captions on the rows' own grid. */
  .head {
    height: var(--head-height);
    display: grid;
    grid-template-columns:
      var(--column-pos) var(--column-cue) var(--chip-width) minmax(0, 1fr) var(--column-laps)
      var(--column-status);
    align-items: center;
    padding: 0 var(--row-padding);
    box-sizing: border-box;
    background: var(--panel-head);
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  .tower[data-layout='detailed'] .head {
    grid-template-columns: var(--detail-columns);
  }

  .caption {
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    text-transform: uppercase;
    color: var(--text-muted);
    white-space: nowrap;
    text-align: right;
  }

  .tower[data-layout='detailed'] .caption {
    padding-left: var(--space-2);
  }

  .caption-pos,
  .caption-car {
    text-align: center;
    padding-left: 0;
  }

  .caption-team {
    text-align: left;
    padding-left: var(--space-3);
  }

  /* The rows: one pill per car, the gaps between them being the look. */
  .rows {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--row-gap);
    margin: var(--row-gap) 0 0;
    padding: 0;
    list-style: none;
  }

  .row {
    /* Hidden until an animation brings it in. */
    opacity: 0;
  }

  /* A row lifting out of the page: out of flow, pinned where it was (the view sets top). */
  .row.is-leaving {
    position: absolute;
    left: 0;
    right: 0;
  }

  .row .pill {
    height: var(--row-height);
    display: grid;
    grid-template-columns:
      var(--column-pos) var(--column-cue) var(--chip-width) minmax(0, 1fr) var(--column-laps)
      var(--column-status);
    align-items: center;
    padding: 0 var(--row-padding);
    box-sizing: border-box;
    font-size: var(--size-row);
    font-weight: var(--weight-row);
    text-transform: var(--case-rows);
    line-height: 1;
  }

  .tower[data-layout='detailed'] .row .pill {
    height: var(--detailed-row-height);
    grid-template-columns: var(--detail-columns);
  }

  /* A car out of the race: the whole pill dimmed; the status icon says why. */
  .row[data-status='retired'] .pill,
  .row[data-status='disqualified'] .pill {
    opacity: var(--status-retired-opacity);
  }

  /* The position: yellow text, no field; the leader's becomes the green chip. */
  .cell-pos {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--chip-height);
    padding-top: var(--glyph-nudge);
    box-sizing: border-box;
    border-radius: var(--radius-chip);
    font-weight: var(--weight-number);
    color: var(--text-pos);
  }

  .row[data-leader] .cell-pos {
    background: var(--leader-background);
    color: var(--leader-text);
  }

  /* The cue lane: the ▲ / ▼ after a position change, and the cell takes its colour. */
  .cell-cue {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cue {
    width: var(--cue-width);
    height: var(--cue-height);
    display: block;
  }

  .is-up .cue {
    color: var(--cue-up);
  }

  .is-down .cue {
    color: var(--cue-down);
  }

  .is-up .cell-pos {
    background: var(--cue-up);
    color: var(--cue-text);
  }

  .is-down .cell-pos {
    background: var(--cue-down);
    color: var(--cue-text);
  }

  /* The car number: the blue chip, the face's high-sitting digits nudged to the centre. */
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--chip-width);
    height: var(--chip-height);
    padding-top: var(--glyph-nudge);
    box-sizing: border-box;
    border-radius: var(--radius-chip);
    background: var(--chip-car-background);
    color: var(--chip-car-text);
    font-weight: var(--weight-number);
    font-size: var(--size-row);
    line-height: 1;
  }

  /* The team: a scrolling box (the kit's scrollingTextStyles) filling its column, never
     wrapping; the school after the name in the detailed layout, the two scrolling as one
     line when too long, with the theme's row tracking (Bebas Neue is tight by design).
     The box sits inside the cell rather than being the cell: a grid cell that clips has no
     automatic minimum height, which shrinks the row's track and lifts every cell of the
     row by a pixel. */
  .cell-team {
    display: flex;
    min-width: 0;
    padding-left: var(--space-3);
    letter-spacing: var(--tracking-row);
  }

  .team-box {
    flex: 1;
    min-width: 0;
  }

  .team-box .scrolling-text {
    display: inline-flex;
    flex: none;
    align-items: baseline;
    gap: var(--space-2);
  }

  .team-name {
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.3;
  }

  .school-name {
    flex: none;
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: 0;
    text-transform: var(--case-rows);
    color: var(--text-muted);
  }

  .tower[data-layout='compact'] .school-name {
    display: none;
  }

  /* The laps: green text, right-aligned. */
  .cell-laps {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    height: var(--chip-height);
    font-weight: var(--weight-number);
    color: var(--text-laps);
  }

  /* The detailed timing columns: right-aligned, the secondary ones muted. */
  .cell-gap,
  .cell-interval,
  .cell-last-lap,
  .cell-best-lap,
  .cell-pit-stops,
  .cell-fuel-stops {
    text-align: right;
    font-size: var(--size-detail);
    font-weight: var(--weight-number);
    white-space: nowrap;
  }

  .cell-interval,
  .cell-best-lap,
  .cell-pit-stops,
  .cell-fuel-stops {
    color: var(--text-muted);
  }

  /* The status lane: the icon at the right edge, one colour, the shape carries the meaning. */
  .cell-status {
    display: flex;
    justify-content: flex-end;
    color: var(--status-icon);
  }

  .status-icon {
    width: var(--status-icon-size);
    height: var(--status-icon-size);
    display: block;
  }
`;
