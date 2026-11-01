/**
 * A team's name with its school after it as a caption, on one line (the design's
 * `.bracket-car__name` and `.standings-row`'s team cell, docs/design/tools/slate-boards.css),
 * against the theme's tokens alone. Moved here at gate 2 of PR #30: the standings row and
 * the bracket use it. Since BAJAOVRLAY-55 the two sit in one scrolling text inside a
 * scrolling box the graphic places (scrollingTextWhenTooLong.ts), and scroll together as one
 * line when too long, never cut with an ellipsis. `.team-with-school` is that text: the two
 * side by side, baseline aligned.
 */
import { css } from 'lit';

export const teamWithSchoolStyles = css`
  .team-with-school.scrolling-text {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .team-name {
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.3;
  }

  .school-name {
    flex: none;
    font-size: var(--size-caption);
    color: var(--text-muted);
  }
`;
