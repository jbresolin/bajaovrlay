/**
 * The plain sponsor roll's DOM, drawn by Lit: one card in the chosen corner (the kit's
 * screenCornerPosition), holding one cell per sponsor of the pass, stacked in one place:
 * the level's heading (the kit's, "PATROCÍNIO DIAMANTE") over the logo, on the light plate
 * when the sponsor says so. Nothing else: no Baja mark, no event word, no title. Which cell
 * is visible is the animations'; Lit keeps the cells across redraws, so the opacity GSAP
 * put on them survives an update on air.
 *
 * Every logo of the pass is in the page from load, so load waits for all of them and a turn
 * never shows a logo still on its way. Images are `<img src>` and nothing else: a logo is a
 * `/media/<id>` the server serves, and an `<img>` runs no script even for an SVG.
 */
import { describeScreenCornerPosition } from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { headingOfSponsorLevel } from '@bajaovrlay/graphics-kit/sponsorRound';
import { html, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { ptBR } from './ptBR.js';
import {
  type PlainRollSponsor,
  readSponsorRollPlainCorner,
  type SponsorRollPlainData,
  type SponsorRollPlainPass,
} from './sponsorRollPlainModel.js';

/** One sponsor's cell: its level's heading over its logo. */
function renderSponsorCell(sponsor: PlainRollSponsor): TemplateResult {
  const logoBoxClass =
    sponsor.logoOnLightPlate === true ? 'sponsor-logo on-light-plate' : 'sponsor-logo';
  return html`<div class="sponsor-cell" data-testid="sponsor-roll-plain-cell">
    <span class="level-heading" data-testid="sponsor-roll-plain-heading"
      >${headingOfSponsorLevel(sponsor.level)}</span
    >
    <span class=${logoBoxClass}
      ><img
        class="sponsor-logo-image"
        src=${sponsor.logoUrl ?? ''}
        alt=${ptBR.sponsorLogoAlternativeText(sponsor.name)}
    /></span>
  </div>`;
}

/**
 * The roll's markup: before load an empty card, invisible until played; after it the card
 * in its corner with a cell for each sponsor of the pass, in its order.
 */
export function renderSponsorRollPlainTemplate(
  data: SponsorRollPlainData | undefined,
  pass: SponsorRollPlainPass | undefined,
): TemplateResult {
  if (data === undefined || pass === undefined) {
    return html`<section class="plain-roll-card" data-testid="sponsor-roll-plain-card"></section>`;
  }
  const cornerOffsets = describeScreenCornerPosition(readSponsorRollPlainCorner(data));
  // Keyed by place and name, so a redraw of the same pass keeps every cell (and its opacity).
  const cells = repeat(
    pass.sponsorsShown,
    (entry, index) => `${String(index)}-${entry.sponsor.name}`,
    (entry) => renderSponsorCell(entry.sponsor),
  );
  return html`<section
    class="plain-roll-card"
    data-testid="sponsor-roll-plain-card"
    style=${styleMap(cornerOffsets)}
  >
    <div class="sponsor-cells">${cells}</div>
  </section>`;
}

/** The card, which the fades move; a missing one is a bug in the template. */
export function findPlainRollCard(renderRoot: ParentNode): HTMLElement {
  const card = renderRoot.querySelector<HTMLElement>('[data-testid="sponsor-roll-plain-card"]');
  if (card === null) {
    throw new Error('the plain roll card is missing from the template; this is a bug');
  }
  return card;
}

/** The sponsors' cells, in the order of the pass. */
export function findSponsorCells(renderRoot: ParentNode): HTMLElement[] {
  return [...renderRoot.querySelectorAll<HTMLElement>('[data-testid="sponsor-roll-plain-cell"]')];
}
