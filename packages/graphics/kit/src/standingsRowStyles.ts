/**
 * A standings row as a pill, shared by the standings and the intermission's top five
 * (BAJAOVRLAY-46, moved here from the standings unchanged): the design's `.row--standings`
 * (PR #21, docs/design/tools/slate-boards.css) against the theme's tokens alone. A row is an
 * element `.row` (what the animations move) holding the slate `.row-pill`, whose grid is the
 * graphic's `--standings-columns`; its cells are the rank (`.cell-rank`, on the green chip
 * for the leader, `data-leader` on the row), the car chip (`.chip`, the kit's carChipStyles),
 * the team with its school (`.cell-team`, and the kit's teamWithSchoolStyles) and the points
 * (`.cell-total`, green).
 * A disqualified team (`data-disqualified`) is dimmed through the pill, as a retired car.
 * The pill's slate is the graphic's `.pill` or `.card` rule, never set here.
 */
import { css } from 'lit';

import { carChipStyles } from './carChipStyles.js';
import { teamWithSchoolStyles } from './teamWithSchoolStyles.js';

export const standingsRowStyles = [
  carChipStyles,
  teamWithSchoolStyles,
  css`
    .row-pill {
      display: grid;
      grid-template-columns: var(--standings-columns);
      align-items: center;
      padding: 0 var(--row-padding);
      box-sizing: border-box;
    }

    .row {
      /* Hidden until an animation brings it in. */
      opacity: 0;
    }

    /* The overall table's pills: 40 px, the strip's 30 px text. */
    .row-pill {
      height: var(--board-row-height);
      font-size: var(--size-board);
      font-weight: var(--weight-row);
      line-height: 1;
    }

    /* A disqualified team: the whole pill dimmed like a retired car. */
    .row[data-disqualified] .row-pill {
      opacity: var(--status-retired-opacity);
    }

    /* The rank: yellow text, no field; rank 1 (tied or not) becomes the green chip. */
    .cell-rank {
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

    .row[data-leader] .cell-rank {
      background: var(--leader-background);
      color: var(--leader-text);
    }

    /* The car number: the kit's chip (carChipStyles), at the row's size. */

    /* The team, cut with an ellipsis inside its column, the school after it as a caption;
     both with the rows' tracking (Bebas Neue is tight by design). */
    .cell-team {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      min-width: 0;
      padding-left: var(--space-3);
      letter-spacing: var(--tracking-row);
    }

    /* The team's name and school: the kit's teamWithSchoolStyles. */

    /* The total (or the points of the columns board): green, right-aligned. */
    .cell-total {
      text-align: right;
      color: var(--text-laps);
      white-space: nowrap;
    }
  `,
];
