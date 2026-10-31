/**
 * The clock card's look in Ardósia, shared by the race clock and the countdown card
 * (BAJAOVRLAY-46: "the race clock's card without the band"): the design's `.race-clock`,
 * `.race-clock__head`, `__logo`, `__title`, `__body`, `__caption`, `__laps` and `__time`
 * rules (PR #19, docs/design/tools/slate-base.css) written against the theme's tokens alone.
 * A card element carries the class `clock-card`; each graphic adds its own height and rows
 * (the race clock's three with the flag band, the countdown's two). The countdown writes
 * its start time where the laps go, in the text colour, by adding `laps-as-text`.
 * No fallback values, by design: without the theme the card is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 */
import { css } from 'lit';

export const clockCardStyles = css`
  /* The card: top-right, 420 wide, inside the title-safe area, like the scoreboard. */
  .clock-card {
    position: absolute;
    top: var(--stage-safe-top);
    right: var(--column-right);
    left: var(--column-left);
    width: var(--column-width);
    display: grid;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Every digit the same width, so the clock never jitters as it counts. */
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* The head: the logo at the left, the session title big at the right, denser slate. */
  .clock-card .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: 0 var(--space-5);
    background: var(--panel-head);
  }

  .clock-card .logo {
    height: var(--clock-logo-height);
    width: auto;
    flex: none;
    object-fit: contain;
  }

  .clock-card .title {
    min-width: 0;
    font-size: var(--size-title);
    font-weight: var(--weight-display);
    letter-spacing: var(--tracking-display);
    text-transform: var(--case-title);
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.3;
    text-align: right;
    /* A scrolling box (scrollingTextStyles, BAJAOVRLAY-55): a session name too long for
       the card scrolls; the box clips and keeps no ellipsis. */
    white-space: nowrap;
    overflow: hidden;
  }

  /* The body: the caption line (caption left, laps right) over the time. */
  .clock-card .body {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'caption laps'
      'time time';
    align-items: center;
    column-gap: var(--space-4);
    /* No bottom padding: the time's line box ends on the body's edge, and the face's
       descender room under the digits is the margin to the card's next row or edge. */
    padding: var(--space-1) var(--space-5) 0;
    overflow: hidden;
  }

  .clock-card .caption {
    grid-area: caption;
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: left;
    white-space: nowrap;
  }

  .clock-card .laps {
    grid-area: laps;
    align-self: center;
    font-size: var(--size-row);
    font-weight: var(--weight-number);
    text-transform: uppercase;
    text-align: right;
    white-space: nowrap;
    color: var(--text-laps);
  }

  /* What sits where the laps go but is not a count (the countdown's start time). */
  .clock-card .laps.laps-as-text {
    color: var(--text);
  }

  .clock-card .time {
    grid-area: time;
    align-self: end;
    font-size: var(--size-time);
    font-weight: var(--weight-display);
    letter-spacing: var(--tracking-time);
    line-height: 1;
  }
`;
