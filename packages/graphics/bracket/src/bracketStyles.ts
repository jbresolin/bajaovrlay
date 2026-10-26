/**
 * The bracket's look in Ardósia, the parts both forms share, on the kit's (bracket.ts adds
 * them before these): the wide board's frame (wideBoardFrameStyles) and head
 * (wideBoardHeadStyles), the car chip (carChipStyles) and the team with its school
 * (teamWithSchoolStyles). Here: each moving piece's holder, the chip's green fill only the
 * winner shows, the team's line, the result cell (a number, the winner's mark, the outlined "W.O." tag or
 * "—"), the dashed empty slot of a bye, and the loser dimmed like a retired row. The design's
 * `.bracket-car*`, `.walkover-tag` and `.bracket-empty` rules (PR #21,
 * docs/design/tools/slate-boards.css), written against the theme's tokens alone: no
 * fallback values, by design, and packages/theme's noHardCodedValues guard keeps it so.
 * The round board's own rules are roundBoardStyles.ts, the tree's bracketTreeStyles.ts.
 */
import { css } from 'lit';

export const bracketStyles = css`
  /* A moving piece's holder has no box of its own (roundBoardView.ts says why it exists). */
  .piece-holder {
    display: contents;
  }

  /* The car's chip: the kit's (carChipStyles), at the row's size, holding the winner's
     green fill under the number. */
  .chip {
    position: relative;
    font-size: var(--size-row);
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

  /* The name and the school are the kit's (teamWithSchoolStyles), with the rows' tracking. */
  .team-name {
    letter-spacing: var(--tracking-row);
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
