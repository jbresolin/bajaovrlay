/**
 * The intermission board's DOM, drawn by Lit (the design's `intermission-board` page and its
 * four `motion-intermission-*` demos, PR #21): the kit's head ("INTERVALO", the event, the
 * date); a body of the next-session card ("A SEGUIR", the session, the count at 96 px,
 * "LARGADA ÀS 10:00") beside the top five (the standings' pills, the kit's
 * standingsRowStyles), or the card alone across the width, its words centred; and the
 * sponsor line (a level's heading and up to four logos).
 *
 * The count's element has no binding, so Lit never writes it: the kit's countdownClock does.
 * The sponsor line turns in place, so it holds two layers in one place, one with the page on
 * air and one with the page turned to. Every element GSAP moves (the head, the next card,
 * the top five's head and rows, the sponsor line, its heading and logos) is alone inside a
 * wrapper with no box of its own: GSAP may take an element it moves out of the page and
 * back, which would corrupt Lit's markers (see the kit's boardHead.ts).
 */
import { renderBoardHead } from '@bajaovrlay/graphics-kit/boardHead';
import { writeTimeOfDayText } from '@bajaovrlay/graphics-kit/countdownText';
import { writePointsAsText } from '@bajaovrlay/graphics-kit/pointsText';
import { renderScrollingText } from '@bajaovrlay/graphics-kit/scrollingTextBox';
import { headingOfSponsorLevel } from '@bajaovrlay/graphics-kit/sponsorRound';
import type { PageIndexOfEachLayer } from '@bajaovrlay/graphics-kit/stackedPageLayers';
import { html, nothing, type TemplateResult } from 'lit';

import {
  type IntermissionBoardData,
  isTeamOnTheLeaderChip,
  listIntermissionBoardParts,
  type SponsorLinePage,
  type TopFiveEntry,
  writeRankOfTeam,
} from './intermissionBoardModel.js';
import { ptBR } from './ptBR.js';

/** The next-session card: the caption, the session, the count and the start time. */
function renderNextSessionCard(data: IntermissionBoardData): TemplateResult {
  return html`<div class="piece-place">
    <div class="card next-card" data-testid="intermission-next">
      <span class="caption">${ptBR.nextCaption}</span>
      <span class="next-session scrolling-text-box" data-testid="intermission-session"
        >${renderScrollingText(data.nextSessionName)}</span
      >
      <span class="next-count" data-testid="intermission-count"></span>
      <span class="next-start" data-testid="intermission-start"
        >${ptBR.startTime(writeTimeOfDayText(data.nextStartsAtMs))}</span
      >
    </div>
  </div>`;
}

/** One team's pill: the rank (the green chip for the leader), the car, the team, the points. */
function renderTopFiveRow(entry: TopFiveEntry): TemplateResult {
  return html`<li class="piece-place">
    <div
      class="row"
      data-testid="intermission-row"
      ?data-leader=${isTeamOnTheLeaderChip(entry)}
      ?data-disqualified=${entry.isDisqualified ?? false}
    >
      <div class="pill row-pill">
        <span class="cell-rank">${writeRankOfTeam(entry)}</span>
        <span class="chip">${entry.carNumber}</span>
        <span class="cell-team"
          ><span class="team-box scrolling-text-box" data-testid="intermission-row-team-box"
            ><span class="scrolling-text team-with-school"
              ><span class="team-name">${entry.teamName}</span
              ><span class="school-name">${entry.schoolName}</span></span
            ></span
          ></span
        >
        <span class="cell-total">${writePointsAsText(entry.points)}</span>
      </div>
    </div>
  </li>`;
}

/** The top five: the head pill and the five rows. */
function renderTopFive(topFive: TopFiveEntry[]): TemplateResult {
  return html`<div class="top-five" data-testid="intermission-top-five">
    <div class="piece-place">
      <header class="pill pill-head top-head" data-testid="intermission-top-head">
        <span class="caption">${ptBR.topFiveCaption}</span>
      </header>
    </div>
    <ol class="rows">
      ${topFive.map(renderTopFiveRow)}
    </ol>
  </div>`;
}

/** One logo of the sponsor line, on the light plate when the sponsor says so. */
function renderLineLogo(sponsor: SponsorLinePage['sponsors'][number]): TemplateResult {
  const logoBoxClass = sponsor.logoOnLightPlate ? 'line-logo on-light-plate' : 'line-logo';
  return html`<span class="piece-place"
    ><span class=${logoBoxClass} data-testid="intermission-line-logo"
      ><img
        class="logo-image"
        src=${sponsor.logoUrl}
        alt=${ptBR.sponsorLogoAlternativeText(sponsor.name)} /></span
  ></span>`;
}

/** One layer of the sponsor line: its page's heading and logos, or nothing. */
function renderSponsorLineLayer(
  layerIndex: number,
  page: SponsorLinePage | undefined,
): TemplateResult {
  const pieces =
    page === undefined
      ? nothing
      : html`<span class="piece-place"
            ><span class="caption line-heading" data-testid="intermission-line-heading"
              >${headingOfSponsorLevel(page.level)}</span
            ></span
          >${page.sponsors.map(renderLineLogo)}`;
  return html`<div class="line-layer" data-testid="intermission-line-layer-${String(layerIndex)}">
    ${pieces}
  </div>`;
}

/** The sponsor line: the card and its two layers stacked in one place. */
function renderSponsorLine(pages: SponsorLinePage[], layers: PageIndexOfEachLayer): TemplateResult {
  const [firstLayerPageIndex, secondLayerPageIndex] = layers;
  const findPage = (pageIndex: number | undefined) =>
    pageIndex === undefined ? undefined : pages[pageIndex];
  return html`<div class="piece-place">
    <div class="card sponsor-line" data-testid="intermission-sponsor-line">
      ${renderSponsorLineLayer(0, findPage(firstLayerPageIndex))}
      ${renderSponsorLineLayer(1, findPage(secondLayerPageIndex))}
    </div>
  </div>`;
}

/**
 * The board's markup for the data and the sponsor line's layers; before load an empty
 * board, invisible until played. data-testid names are how code and tests find parts.
 */
export function renderIntermissionBoardTemplate(
  data: IntermissionBoardData | undefined,
  sponsorLineLayers: PageIndexOfEachLayer,
): TemplateResult {
  if (data === undefined) {
    return html`<section class="board" data-testid="intermission-board"></section>`;
  }
  const parts = listIntermissionBoardParts(data);
  const hasTopFive = parts.topFive.length > 0;
  const hasSponsorLine = parts.sponsorLinePages.length > 0;
  return html`<section class="board" data-testid="intermission-board">
    ${renderBoardHead({
      testIdPrefix: 'intermission',
      logoAlternativeText: ptBR.logoAlternativeText,
      title: ptBR.title,
      subtitle: parts.eventLine,
      aside: parts.dateLine,
    })}
    <div
      class=${hasTopFive ? 'intermission-body' : 'intermission-body single'}
      data-testid="intermission-body"
    >
      ${renderNextSessionCard(data)} ${hasTopFive ? renderTopFive(parts.topFive) : nothing}
    </div>
    ${hasSponsorLine ? renderSponsorLine(parts.sponsorLinePages, sponsorLineLayers) : nothing}
  </section>`;
}

/** The pieces of the board on the page, for the animations; each undefined when absent. */
export type IntermissionBoardPieces = {
  board: HTMLElement;
  head: HTMLElement;
  nextCard: HTMLElement;
  topHead: HTMLElement | undefined;
  rows: HTMLElement[];
  sponsorLine: HTMLElement | undefined;
};

/** Finds one part by its test id, or undefined. */
function findOptionalPart(renderRoot: ParentNode, testId: string): HTMLElement | undefined {
  return renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** Finds one part that must be there; a missing one is a bug in the template. */
function findPart(renderRoot: ParentNode, testId: string): HTMLElement {
  const part = findOptionalPart(renderRoot, testId);
  if (part === undefined) {
    throw new Error(`intermission board part "${testId}" is missing from the template; a bug`);
  }
  return part;
}

/** Finds the board's pieces on the page. */
export function findIntermissionBoardPieces(renderRoot: ParentNode): IntermissionBoardPieces {
  return {
    board: findPart(renderRoot, 'intermission-board'),
    head: findPart(renderRoot, 'intermission-head'),
    nextCard: findPart(renderRoot, 'intermission-next'),
    topHead: findOptionalPart(renderRoot, 'intermission-top-head'),
    rows: [...renderRoot.querySelectorAll<HTMLElement>('[data-testid="intermission-row"]')],
    sponsorLine: findOptionalPart(renderRoot, 'intermission-sponsor-line'),
  };
}

/** The pieces of one layer of the sponsor line: its heading, then its logos. */
export function findSponsorLineLayerPieces(
  renderRoot: ParentNode,
  layerIndex: number,
): HTMLElement[] {
  const layer = findOptionalPart(renderRoot, `intermission-line-layer-${String(layerIndex)}`);
  if (layer === undefined) {
    return [];
  }
  return [
    ...layer.querySelectorAll<HTMLElement>(
      '[data-testid="intermission-line-heading"], [data-testid="intermission-line-logo"]',
    ),
  ];
}

/** The count's element, which the countdown clock writes; undefined before load. */
export function findIntermissionCount(renderRoot: ParentNode): HTMLElement | undefined {
  return findOptionalPart(renderRoot, 'intermission-count');
}
