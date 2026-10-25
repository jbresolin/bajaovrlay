/**
 * The look of a team's logo cell (teamLogoCell.ts) in Ardósia: the design's `.logo` rules
 * (docs/design/tools/slate-cards.css), against the theme's tokens alone, as the team card
 * drew it before it moved here (gate 2 of PR #27). The box's size is the graphic's: it sets
 * `--team-logo-cell-width` and `--team-logo-cell-height` (the team card a 112 px square,
 * the podium 240 × 112).
 */
import { css } from 'lit';

export const teamLogoCellStyles = css`
  /* The logo's box: the logo whole inside it, keeping its own shape. */
  .team-logo-cell {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: var(--team-logo-cell-width);
    height: var(--team-logo-cell-height);
  }

  /* A dark logo, or one on its own white box, sits on the small light plate. */
  .team-logo-cell--on-light-plate {
    padding: var(--logo-plate-padding);
    border-radius: var(--radius-chip);
    background: var(--panel-light);
  }

  .team-logo-cell__image {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
  }
`;
