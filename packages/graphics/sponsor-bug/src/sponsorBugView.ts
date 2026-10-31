/**
 * The sponsor bug's DOM, drawn by Lit from the data: the Baja SAE Brasil mark, then a
 * column with the event word ("ENDURO") and the sponsor cell (the caption over the
 * sponsor's logo). Like the team card, a part with nothing to show is simply not in the
 * template, so a bug without a sponsor is the mark and the event word alone and never
 * an empty cell (the brief). Lit keeps the card element itself across redraws, so the
 * animations' inline styles on it survive an update on air.
 *
 * Images are `<img src>` and nothing else: the mark is bundled from the theme, the
 * sponsor's logo is a `/media/<id>` the server serves, and an `<img>` runs no script even
 * when the file is an SVG.
 */
// The white mark lives in the theme package; Vite bundles a copy into this graphic's
// dist/assets/, so the built bug works from the preview and from the air alike.
import { renderScrollingText } from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
import markAddress from '@bajaovrlay/theme/brand/logo-branca.png';
import { html, nothing, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';
import {
  listSponsorBugCells,
  type SponsorBugCells,
  type SponsorBugData,
} from './sponsorBugModel.js';

/** The caption over the sponsor's logo ("Apresentado por"), a scrolling box (BAJAOVRLAY-55). */
function renderCaption(data: SponsorBugData): TemplateResult {
  return html`<span class="caption scrolling-text-box" data-testid="sponsor-bug-caption"
    >${renderScrollingText(data.caption ?? '')}</span
  >`;
}

/** The sponsor cell: the caption (when given) over the logo, on the card or on the plate. */
function renderSponsorCell(data: SponsorBugData, cells: SponsorBugCells): TemplateResult {
  const logoBoxClass = cells.isSponsorLogoOnLightPlate
    ? 'sponsor-logo on-light-plate'
    : 'sponsor-logo';
  const caption = cells.hasCaption ? renderCaption(data) : nothing;
  return html`<span class="sponsor" data-testid="sponsor-bug-sponsor-cell"
    >${caption}<span class=${logoBoxClass} data-testid="sponsor-bug-sponsor-logo-box"
      ><img
        class="sponsor-logo-image"
        data-testid="sponsor-bug-sponsor-logo"
        src=${data.sponsorLogoUrl ?? ''}
        alt=${ptBR.sponsorLogoAlternativeText} /></span
  ></span>`;
}

/** The event word beside the mark ("ENDURO"), a scrolling box (BAJAOVRLAY-55). */
function renderEventWord(data: SponsorBugData): TemplateResult {
  return html`<span class="event-word scrolling-text-box" data-testid="sponsor-bug-event-word"
    >${renderScrollingText(data.eventWord ?? '')}</span
  >`;
}

/** The column beside the mark: the event word over the sponsor cell, each when it exists. */
function renderTextColumn(data: SponsorBugData, cells: SponsorBugCells): TemplateResult {
  const eventWord = cells.hasEventWord ? renderEventWord(data) : nothing;
  const sponsorCell = cells.hasSponsorCell ? renderSponsorCell(data, cells) : nothing;
  return html`<div class="text-column">${eventWord}${sponsorCell}</div>`;
}

/**
 * The card's markup for the data; before load (no data yet) an empty card, invisible
 * until played. data-testid names are how code and tests find parts. With neither a word
 * nor a sponsor the card is the mark alone, with no empty column beside it.
 */
export function renderSponsorBugTemplate(data: SponsorBugData | undefined): TemplateResult {
  if (data === undefined) {
    return html`<section class="sponsor-bug" data-testid="sponsor-bug-panel"></section>`;
  }
  const cells = listSponsorBugCells(data);
  const hasTextColumn = cells.hasEventWord || cells.hasSponsorCell;
  const textColumn = hasTextColumn ? renderTextColumn(data, cells) : nothing;
  return html`<section class="sponsor-bug" data-testid="sponsor-bug-panel">
    <img
      class="mark"
      src=${markAddress}
      alt=${ptBR.markAlternativeText}
      data-testid="sponsor-bug-mark"
    />${textColumn}
  </section>`;
}

/** Finds the card element in the rendered template; a missing one is a bug in the template. */
export function findSponsorBugPanel(renderRoot: ParentNode): HTMLElement {
  const panel = renderRoot.querySelector<HTMLElement>('[data-testid="sponsor-bug-panel"]');
  if (panel === null) {
    throw new Error('the sponsor bug element is missing from the template; this is a bug');
  }
  return panel;
}
