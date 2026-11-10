/**
 * The "a seguir" card's DOM, drawn by Lit: the lower third's slot with the head line ("A
 * SEGUIR · SEMIFINAL", "MD3" at its right) over the two sides, car A on the left and car B
 * mirrored on the right, the "×" (or, once started, the score) between them. Each side is
 * the team's logo (the kit's logo cell, on the light plate when the team chose it) or,
 * without a logo, the large car chip in its place; then the team's name over its school,
 * city and state. The name and the details are scrolling boxes of the kit: too long for
 * the side, they scroll inside it (BAJAOVRLAY-55).
 *
 * The panel is what the animations move, and Lit keeps it across redraws. With no match
 * to show (an empty "a seguir") the panel is drawn empty and hidden (matchCardStyles.ts).
 * A logo is an <img> only, which runs no script even for an SVG
 * (packages/graphics/README.md). A logo that fails to load is never left as a broken
 * image: the card is told (`LogoFailures`) and draws the car chip in its place.
 */
import { renderScrollingText } from '@bajaovrlay/graphics-kit/scrollingTextBox';
import { renderTeamLogoCell } from '@bajaovrlay/graphics-kit/teamLogoCell';
import { html, nothing, type TemplateResult } from 'lit';

import type { MatchCardCarLook, MatchCardLook, MatchCardMatchLook } from './matchCardModel.js';
import { ptBR } from './ptBR.js';

/** Which side of the card a team is drawn on: car A on the left, car B mirrored. */
type CardSide = 'a' | 'b';

/** The logos that failed to load, and how to report one more; kept by the card element. */
export type LogoFailures = {
  failedLogoUrls: ReadonlySet<string>;
  onLogoFailed: (logoUrl: string) => void;
};

/** The team's logo cell, or its large car chip when it has no logo or its logo failed. */
function renderLogoOrChip(
  car: MatchCardCarLook,
  side: CardSide,
  logoFailures: LogoFailures,
): TemplateResult {
  const logo = car.logo;
  if (logo === undefined || logoFailures.failedLogoUrls.has(logo.url)) {
    return html`<span class="car-chip-large" data-testid=${`match-card-chip-${side}`}
      >${car.carNumber}</span
    >`;
  }
  return renderTeamLogoCell({
    logoUrl: logo.url,
    alternativeText: ptBR.logoAlternativeText(car.teamName),
    isOnLightPlate: logo.isOnLightPlate,
    cellTestId: `match-card-logo-cell-${side}`,
    imageTestId: `match-card-logo-${side}`,
    onLogoFailed: () => logoFailures.onLogoFailed(logo.url),
  });
}

/** One side: the logo or chip, then the team's name over its details line. */
function renderSide(
  car: MatchCardCarLook,
  side: CardSide,
  logoFailures: LogoFailures,
): TemplateResult {
  const details =
    car.detailsLine === undefined
      ? nothing
      : html`<span class="details scrolling-text-box" data-testid=${`match-card-details-${side}`}
          >${renderScrollingText(car.detailsLine)}</span
        >`;
  return html`<span class="side" data-side=${side} data-testid=${`match-card-side-${side}`}
    >${renderLogoOrChip(car, side, logoFailures)}<span class="identity"
      ><span class="team-name scrolling-text-box" data-testid=${`match-card-team-${side}`}
        >${renderScrollingText(car.teamName)}</span
      >${details}</span
    ></span
  >`;
}

/** Between the sides: "×" before the match starts, "1 × 0" (or the times) once it has. */
function renderMiddle(match: MatchCardMatchLook): TemplateResult {
  if (!match.hasStarted) {
    return html`<span class="middle" data-testid="match-card-middle"
      ><span class="versus">${ptBR.versusMark}</span></span
    >`;
  }
  const [carA, carB] = match.cars;
  return html`<span class="middle" data-testid="match-card-middle"
    ><span class="result">${carA.resultText ?? ''}</span
    ><span class="versus">${ptBR.versusMark}</span
    ><span class="result">${carB.resultText ?? ''}</span></span
  >`;
}

/** The head line: "A SEGUIR · SEMIFINAL", and the series tag at the right. */
function renderHeadLine(match: MatchCardMatchLook): TemplateResult {
  const roundPart =
    match.roundName === undefined
      ? nothing
      : html`<span class="round-name">${ptBR.detailsSeparator}${match.roundName}</span>`;
  const seriesTag =
    match.seriesTag === undefined
      ? nothing
      : html`<span class="series-tag" data-testid="match-card-series">${match.seriesTag}</span>`;
  return html`<span class="head-line" data-testid="match-card-head"
    ><span class="head-words"><span class="up-next-word">${ptBR.upNextWord}</span>${roundPart}</span
    >${seriesTag}</span
  >`;
}

/** The card's content: the head line over the two sides and what goes between them. */
function renderMatch(match: MatchCardMatchLook, logoFailures: LogoFailures): TemplateResult {
  const [carA, carB] = match.cars;
  return html`${renderHeadLine(match)}<span class="sides"
      >${renderSide(carA, 'a', logoFailures)}${renderMiddle(match)}${renderSide(
        carB,
        'b',
        logoFailures,
      )}</span
    >`;
}

/**
 * The card's markup: before load (no look yet) an empty panel, invisible until played;
 * after that the panel with the match, or empty and hidden when there is none to show.
 */
export function renderMatchCardTemplate(
  look: MatchCardLook | undefined,
  logoFailures: LogoFailures,
): TemplateResult {
  const match = look?.match;
  return html`<div
    class="match-card"
    data-testid="match-card-panel"
    data-has-match=${match === undefined ? 'false' : 'true'}
  >
    ${match === undefined ? nothing : renderMatch(match, logoFailures)}
  </div>`;
}

/** Finds the panel in the rendered template; a missing one is a bug in the template. */
export function findMatchCardPanel(renderRoot: ParentNode): HTMLElement {
  const panel = renderRoot.querySelector<HTMLElement>('[data-testid="match-card-panel"]');
  if (panel === null) {
    throw new Error('the "a seguir" card panel is missing from the template; this is a bug');
  }
  return panel;
}
