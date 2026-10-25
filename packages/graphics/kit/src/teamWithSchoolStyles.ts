/**
 * A team's name with its school after it as a caption, on one line: the name cut with an
 * ellipsis, the school never (the design's `.bracket-car__name` and `.standings-row`'s
 * team cell, docs/design/tools/slate-boards.css), against the theme's tokens alone. Moved
 * here at gate 2 of PR #30: the standings row and the bracket use it. The graphic's own
 * container lays the two out side by side (a flex row, baseline aligned).
 */
import { css } from 'lit';

export const teamWithSchoolStyles = css`
  .team-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* The line box holds the accents of a caps face (Bebas puts them above the cap height). */
    line-height: 1.3;
  }

  .school-name {
    flex: none;
    font-size: var(--size-caption);
    color: var(--text-muted);
  }
`;
