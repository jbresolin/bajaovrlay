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

/** The logo cell: the logo whole inside its box, on the panel or on the light plate. */
function renderLogoCell(data: TeamCardData, isOnLightPlate: boolean): TemplateResult {
  const logoCellClass = isOnLightPlate ? 'logo on-light-plate' : 'logo';
  return html`<span class=${logoCellClass} data-testid="team-card-logo-cell"
    ><img
      class="logo-image"
      data-testid="team-card-logo"
      src=${data.logoUrl ?? ''}
      alt=${ptBR.logoAlternativeText(data.teamName)}
  /></span>`;
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

/** The text block: the chip and the name on the first line, the school and the place under. */
function renderIdentity(data: TeamCardData): TemplateResult {
  const placeLine = writePlaceLine(data);
  return html`<div class="identity" data-testid="team-card-identity">
    <div class="title">
      <span class="chip" data-testid="team-card-car-number">${data.carNumber}</span>
      <span class="team-name" data-testid="team-card-team-name">${data.teamName}</span>
    </div>
    <div class="details">
      <span class="school-name" data-testid="team-card-school-name">${data.schoolName}</span
      >${placeLine === undefined ? nothing : renderPlaceLine(placeLine)}
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
