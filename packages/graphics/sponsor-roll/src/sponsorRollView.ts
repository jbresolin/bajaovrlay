/**
 * The sponsor roll's DOM, drawn by Lit, in one of two layouts (the design's `sponsor-roll`
 * and `sponsor-roll-canto` pages, PR #21):
 * - `fullscreen`: the narrow board: the kit's head ("PATROCINADORES", the page's level
 *   heading, "1/5") over up to six tiles of one level, each a card holding the logo in one
 *   box (on the light plate when the sponsor says so), centred when a page has fewer;
 * - `corner`: the bug's card (the kit's bugCardStyles): the mark, the event word, and the
 *   sponsor cell, the level's heading over one sponsor's logo.
 *
 * A page turns in place, so each layout holds two layers in one place: two tile grids on
 * the full screen, two sponsor cells in the corner, one showing the page on air and the
 * other the page being turned to. Which page each layer shows is the graphic's; which one
 * is visible is the animations'. A tile GSAP moves sits alone in a wrapper with no box of
 * its own: GSAP may take an element it moves out of the page and back, which would corrupt
 * Lit's markers around a list item (see the kit's boardHead.ts).
 *
 * Images are `<img src>` and nothing else: the mark is bundled from the theme, a logo is a
 * `/media/<id>` the server serves, and an `<img>` runs no script even for an SVG.
 */
import { renderBoardHead } from '@bajaovrlay/graphics-kit/boardHead';
import { headingOfSponsorLevel } from '@bajaovrlay/graphics-kit/sponsorRound';
import type { PageIndexOfEachLayer } from '@bajaovrlay/graphics-kit/stackedPageLayers';
// The white mark lives in the theme package; Vite bundles a copy into this graphic's dist/.
import markAddress from '@bajaovrlay/theme/brand/logo-branca.png';
import { html, nothing, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';
import {
  hasEventWord,
  type SponsorRollData,
  type SponsorRollPage,
  type SponsorRollSponsor,
} from './sponsorRollModel.js';

/** What the roll shows now: its pages, the page each layer holds, and the page on air. */
export type SponsorRollViewState = {
  pages: SponsorRollPage[];
  /** The page index each of the two layers shows; undefined for an empty layer. */
  pageIndexOfLayer: PageIndexOfEachLayer;
  /** The page on air, which the head names. */
  pageIndexOnAir: number;
};

/** The page a layer shows, or undefined for an empty layer. */
function findPageOf(
  state: SponsorRollViewState,
  pageIndex: number | undefined,
): SponsorRollPage | undefined {
  return pageIndex === undefined ? undefined : state.pages[pageIndex];
}

/** One tile: the card with the logo in its box, inside its wrapper. */
function renderTile(sponsor: SponsorRollSponsor): TemplateResult {
  const logoBoxClass = sponsor.logoOnLightPlate ? 'tile-logo on-light-plate' : 'tile-logo';
  return html`<div class="tile-place">
    <div class="card sponsor-tile" data-testid="sponsor-roll-tile">
      <span class=${logoBoxClass}
        ><img
          class="logo-image"
          data-testid="sponsor-roll-tile-logo"
          src=${sponsor.logoUrl}
          alt=${ptBR.sponsorLogoAlternativeText(sponsor.name)}
      /></span>
    </div>
  </div>`;
}

/** One tile grid layer, showing the tiles of a page (or none). */
function renderTileGrid(layerIndex: number, page: SponsorRollPage | undefined): TemplateResult {
  const tiles = page === undefined ? [] : page.sponsors.map(renderTile);
  return html`<div class="tile-grid" data-testid="sponsor-roll-grid-${String(layerIndex)}">
    ${tiles}
  </div>`;
}

/** The full screen: the head and the two tile grids stacked in one place. */
function renderFullscreen(state: SponsorRollViewState): TemplateResult {
  const pageOnAir = state.pages[state.pageIndexOnAir];
  const [firstLayerPageIndex, secondLayerPageIndex] = state.pageIndexOfLayer;
  return html`<section class="board" data-testid="sponsor-roll-panel" data-layout="fullscreen">
    ${renderBoardHead({
      testIdPrefix: 'sponsor-roll',
      logoAlternativeText: ptBR.markAlternativeText,
      title: ptBR.fullscreenTitle,
      subtitle: pageOnAir === undefined ? undefined : headingOfSponsorLevel(pageOnAir.level),
      aside: ptBR.pageLine(state.pageIndexOnAir + 1, state.pages.length),
    })}
    <div class="page-stack">
      ${renderTileGrid(0, findPageOf(state, firstLayerPageIndex))}
      ${renderTileGrid(1, findPageOf(state, secondLayerPageIndex))}
    </div>
  </section>`;
}

/** One sponsor cell layer of the corner: its level's heading over its logo (or empty). */
function renderSponsorCell(layerIndex: number, page: SponsorRollPage | undefined): TemplateResult {
  const sponsor = page?.sponsors[0];
  const testId = `sponsor-roll-cell-${String(layerIndex)}`;
  if (page === undefined || sponsor === undefined) {
    return html`<span class="sponsor sponsor-cell" data-testid=${testId}></span>`;
  }
  const logoBoxClass = sponsor.logoOnLightPlate ? 'sponsor-logo on-light-plate' : 'sponsor-logo';
  return html`<span class="sponsor sponsor-cell" data-testid=${testId}
    ><span class="caption" data-testid="sponsor-roll-cell-heading"
      >${headingOfSponsorLevel(page.level)}</span
    ><span class=${logoBoxClass}
      ><img
        class="sponsor-logo-image"
        data-testid="sponsor-roll-cell-logo"
        src=${sponsor.logoUrl}
        alt=${ptBR.sponsorLogoAlternativeText(sponsor.name)} /></span
  ></span>`;
}

/** The corner: the bug's card, the event word and the two sponsor cells stacked in one place. */
function renderCorner(data: SponsorRollData, state: SponsorRollViewState): TemplateResult {
  const [firstLayerPageIndex, secondLayerPageIndex] = state.pageIndexOfLayer;
  const eventWord = hasEventWord(data)
    ? html`<span class="event-word" data-testid="sponsor-roll-event-word">${data.eventWord}</span>`
    : nothing;
  return html`<section class="sponsor-bug" data-testid="sponsor-roll-panel" data-layout="corner">
    <img class="mark" src=${markAddress} alt=${ptBR.markAlternativeText} />
    <div class="text-column">
      ${eventWord}
      <span class="sponsor-cells">
        ${renderSponsorCell(0, findPageOf(state, firstLayerPageIndex))}
        ${renderSponsorCell(1, findPageOf(state, secondLayerPageIndex))}
      </span>
    </div>
  </section>`;
}

/**
 * The roll's markup for the data and what it shows now; before load an empty board,
 * invisible until played. data-testid names are how code and tests find parts.
 */
export function renderSponsorRollTemplate(
  data: SponsorRollData | undefined,
  state: SponsorRollViewState,
): TemplateResult {
  if (data === undefined) {
    return html`<section class="board" data-testid="sponsor-roll-panel"></section>`;
  }
  return data.layout === 'fullscreen' ? renderFullscreen(state) : renderCorner(data, state);
}

/** Finds one part by its test id; a missing one is a bug in the template. */
function findPart(renderRoot: ParentNode, testId: string): HTMLElement {
  const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (part === null) {
    throw new Error(`sponsor roll part "${testId}" is missing from the template; this is a bug`);
  }
  return part;
}

/** The roll's frame: the board, or the corner's card. */
export function findSponsorRollPanel(renderRoot: ParentNode): HTMLElement {
  return findPart(renderRoot, 'sponsor-roll-panel');
}

/** The full screen's head card. */
export function findSponsorRollHead(renderRoot: ParentNode): HTMLElement {
  return findPart(renderRoot, 'sponsor-roll-head');
}

/** The tiles of one grid layer, in reading order. */
export function findTilesOfLayer(renderRoot: ParentNode, layerIndex: number): HTMLElement[] {
  const grid = findPart(renderRoot, `sponsor-roll-grid-${String(layerIndex)}`);
  return [...grid.querySelectorAll<HTMLElement>('[data-testid="sponsor-roll-tile"]')];
}

/** One of the corner's two sponsor cell layers. */
export function findSponsorCellOfLayer(renderRoot: ParentNode, layerIndex: number): HTMLElement {
  return findPart(renderRoot, `sponsor-roll-cell-${String(layerIndex)}`);
}
