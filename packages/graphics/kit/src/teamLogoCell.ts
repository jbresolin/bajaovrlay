/**
 * A team's logo cell, as the team card and the podium draw it (gate 2 of PR #27): the logo
 * whole inside its box, keeping its own shape, on the panel as it is or on the small light
 * plate when the team chose it (`logoOnLightPlate`, BAJAOVRLAY-24). The markup is here and
 * the look in teamLogoCellStyles.ts; each graphic sets the box's size through
 * `--team-logo-cell-width` and `--team-logo-cell-height` on its host.
 *
 * A logo is drawn with <img> only: an <img> runs no script, even for an SVG
 * (packages/graphics/README.md).
 */
import { html, type TemplateResult } from 'lit';

/** What one logo cell shows, and the test ids it carries (the graphic's own names). */
export type TeamLogoCellContent = {
  /** The logo's /media address. */
  logoUrl: string;
  /** The pt-BR alternative text, naming the team. */
  alternativeText: string;
  isOnLightPlate: boolean;
  /** The test id of the cell ("team-card-logo-cell"); the image's is `imageTestId`. */
  cellTestId: string;
  imageTestId: string;
};

/** The cell's markup: the box, on the light plate or not, holding the logo image. */
export function renderTeamLogoCell(content: TeamLogoCellContent): TemplateResult {
  const cellClass = content.isOnLightPlate
    ? 'team-logo-cell team-logo-cell--on-light-plate'
    : 'team-logo-cell';
  return html`<span class=${cellClass} data-testid=${content.cellTestId}
    ><img
      class="team-logo-cell__image"
      data-testid=${content.imageTestId}
      src=${content.logoUrl}
      alt=${content.alternativeText}
  /></span>`;
}
