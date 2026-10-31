/**
 * The team card's DOM, drawn by Lit from the data: the photo cell, the text block (the big
 * chip and the team's name over the school and the place line) and the logo cell. Unlike
 * the notice, which hides parts it drew once, a cell the team has no media for is simply
 * not in the template: the card's width and height come from the cells that exist, so a
 * missing photo or logo gives the narrower card the design shows, never an empty frame.
 * Lit keeps the card element itself across redraws, so the animations' inline styles on
 * it survive an update on air.
 *
 * Images are `<img src>` and nothing else: the address is a `/media/<id>` the server
 * serves, and an `<img>` runs no script even when the file is an SVG.
 */
import { renderScrollingText } from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
import { renderTeamLogoCell } from '@bajaovrlay/graphics-kit/teamLogoCell';
import { html, nothing, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';
import { listTeamCardCells, type TeamCardData, writePlaceLine } from './teamCardModel.js';

/** The photo cell: the car's photo, cropped to fill its box. */
function renderPhotoCell(data: TeamCardData): TemplateResult {
  return html`<img
    class="photo"
    data-testid="team-card-photo"
    src=${data.carPhotoUrl ?? ''}
    alt=${ptBR.carPhotoAlternativeText(data.carNumber)}
  />`;
}

/** The logo cell: the kit's, the logo whole inside its box, on the panel or on the plate. */
function renderLogoCell(data: TeamCardData, isOnLightPlate: boolean): TemplateResult {
  return renderTeamLogoCell({
    logoUrl: data.logoUrl ?? '',
    alternativeText: ptBR.logoAlternativeText(data.teamName),
    isOnLightPlate,
    cellTestId: 'team-card-logo-cell',
    imageTestId: 'team-card-logo',
  });
}

/** The place line after the school, led by the design's middle dot. */
function renderPlaceLine(placeLine: string): TemplateResult {
  return html`<span
      class="details-separator"
      data-testid="team-card-details-separator"
      aria-hidden="true"
      >${ptBR.detailsSeparator}</span
    ><span class="place-line" data-testid="team-card-place-line">${placeLine}</span>`;
}

/** The details line's one scrolling text: the school, then the place line, side by side. */
function renderDetailsLine(schoolName: string, placeLine: string | undefined): TemplateResult {
  return html`<span class="scrolling-text"
    ><span class="school-name" data-testid="team-card-school-name">${schoolName}</span
    >${placeLine === undefined ? nothing : renderPlaceLine(placeLine)}</span
  >`;
}

/**
 * The text block: the chip and the name on the first line, the school and the place under.
 * The name and the details line are the kit's scrolling boxes (BAJAOVRLAY-55): too long
 * for a card at `--lower-third-max-width`, each scrolls inside its box, the school and the
 * place line together as one line.
 */
function renderIdentity(data: TeamCardData): TemplateResult {
  const placeLine = writePlaceLine(data);
  return html`<div class="identity" data-testid="team-card-identity">
    <div class="title">
      <span class="car-chip-large" data-testid="team-card-car-number">${data.carNumber}</span>
      <span class="team-name scrolling-text-box" data-testid="team-card-team-name"
        >${renderScrollingText(data.teamName)}</span
      >
    </div>
    <div class="details scrolling-text-box" data-testid="team-card-details">
      ${renderDetailsLine(data.schoolName, placeLine)}
    </div>
  </div>`;
}

/**
 * The card's markup for the data; before load (no data yet) an empty card, invisible
 * until played. data-testid names are how code and tests find parts.
 */
export function renderTeamCardTemplate(data: TeamCardData | undefined): TemplateResult {
  if (data === undefined) {
    return html`<section class="team-card" data-testid="team-card-panel"></section>`;
  }
  const cells = listTeamCardCells(data);
  return html`<section class="team-card" data-testid="team-card-panel">
    ${cells.hasPhotoCell ? renderPhotoCell(data) : nothing}${renderIdentity(data)}${
      cells.hasLogoCell ? renderLogoCell(data, cells.isLogoOnLightPlate) : nothing
    }
  </section>`;
}

/** Finds the card element in the rendered template; a missing one is a bug in the template. */
export function findTeamCardPanel(renderRoot: ParentNode): HTMLElement {
  const panel = renderRoot.querySelector<HTMLElement>('[data-testid="team-card-panel"]');
  if (panel === null) {
    throw new Error('the team card element is missing from the template; this is a bug');
  }
  return panel;
}
