/**
 * The bracket's look in Ardósia, the parts both forms share: the board on the title-safe
 * area under the kit's wide head (wideBoardHeadStyles, added before these), the stage, and
 * the pieces of a car: the chip (the tower's, with a green fill only the winner shows), the
 * team and school, the result cell (a number, the winner's mark, the outlined "W.O." tag or
 * "—"), the dashed empty slot of a bye, and the loser dimmed like a retired row. The design's
 * `.bracket-car*`, `.walkover-tag` and `.bracket-empty` rules (PR #21,
 * docs/design/tools/slate-boards.css), written against the theme's tokens alone: no
 * fallback values, by design, and packages/theme's noHardCodedValues guard keeps it so.
 * The round board's own rules are roundBoardStyles.ts, the tree's bracketTreeStyles.ts.
 */
import { css } from 'lit';

export const bracketStyles = css`
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

  /* The room under the head: a round board's cards, or the tree's stage. */
  .stage {
    position: relative;
    flex: 1;
  }

  /* The car's chip: the tower's blue square, with the winner's green fill under the number. */
  .chip {
    position: relative;
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
    flex: none;
    overflow: hidden;
  }

  .chip-winner-fill {
    position: absolute;
    inset: 0;
    background: var(--leader-background);
    opacity: 0;
  }

  [data-outcome='winner'] .chip-winner-fill {
    opacity: 1;
  }

  .chip-number {
    position: relative;
  }

  /* The team and its school on one line; a long team name is cut, never the school. */
  .team {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
  }

  .team-name {
    overflow: hidden;
    text-overflow: ellipsis;
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.3;
    letter-spacing: var(--tracking-row);
  }

  .school-name {
    flex: none;
    font-size: var(--size-caption);
    color: var(--text-muted);
  }

  /* The result cell: a time in the detail size, a count of wins at the row's size. */
  .result {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 2ch;
    font-size: var(--size-detail);
    white-space: nowrap;
    color: var(--text-muted);
  }

  .result[data-result-kind='number'] {
    font-size: var(--size-row);
    color: var(--text);
  }

  [data-outcome='winner'] .result {
    color: var(--text-laps);
  }

  .winner-mark {
    width: var(--bracket-win-icon-size);
    height: var(--bracket-win-icon-size);
  }

  /* W.O.: an outlined tag in the winner's green, the same in any round and either form. */
  .walkover-tag {
    display: inline-flex;
    align-items: center;
    height: var(--chip-height);
    padding: var(--glyph-nudge) var(--space-2) 0;
    box-sizing: border-box;
    border: var(--bracket-outline-width) solid currentColor;
    border-radius: var(--radius-chip);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    line-height: 1;
  }

  /* A bye's empty slot: muted words in a dashed outline, so it never reads as a car. */
  .no-opponent {
    display: inline-flex;
    align-items: center;
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* The loser dims like a retired row; the piece around it is what moves. */
  [data-outcome='loser'] {
    opacity: var(--status-retired-opacity);
  }
`;
