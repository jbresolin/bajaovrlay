/**
 * The match bug's DOM, drawn by Lit: one panel in the chosen corner (the kit's
 * screenCornerPosition), holding the round over "47 CORISCO 1 × 2 PEQUI 12". In the
 * top-left corner the panel stands beside the sponsor bug (an inset of the bug's width and
 * a gap), as the kit asks of a graphic that shares a corner with a persistent one.
 *
 * The panel is what the fade moves, and Lit keeps it across redraws, so the fade's inline
 * opacity survives an update on air. With no match to show (an empty "agora") the panel
 * is drawn empty and hidden (matchBugStyles.ts), never half a match. Each car carries its
 * outcome (`data-outcome`): the winner's chip turns green and its result too, the loser
 * is dimmed, as the bracket marks them. The short names and the round are scrolling boxes
 * of the kit: a name too long for its box scrolls inside it (BAJAOVRLAY-55).
 */
import {
  describeScreenCornerPosition,
  type ScreenCorner,
  type ScreenCornerInset,
} from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { renderScrollingText } from '@bajaovrlay/graphics-kit/scrollingTextBox';
import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import type { MatchBugCarLook, MatchBugLook, MatchBugMatchLook } from './matchBugModel.js';
import { ptBR } from './ptBR.js';

/** Which side of the bug a car is drawn on: car A on the left, car B mirrored on the right. */
type CarSide = 'a' | 'b';

/**
 * In the top-left corner the sponsor bug already stands: the match bug moves in by the
 * bug's width and a gap, so the two sit side by side. The other corners keep the safe edge.
 */
function chooseInsetOfTheCorner(corner: ScreenCorner): ScreenCornerInset {
  if (corner === 'top-left') {
    return { fromTheSide: 'calc(var(--bug-width) + var(--space-4))' };
  }
  return {};
}

/** The car's chip, its short name, and its result cell when it has one. */
function renderCar(car: MatchBugCarLook, side: CarSide): TemplateResult {
  const chip = html`<span
    class="chip"
    data-testid="match-bug-car-number"
    aria-label=${car.outcome === 'winner' ? ptBR.winnerLabel : nothing}
    >${car.carNumber}</span
  >`;
  const name = html`<span class="car-name scrolling-text-box" data-testid="match-bug-car-name"
    >${renderScrollingText(car.shortName)}</span
  >`;
  const result =
    car.resultText === undefined
      ? nothing
      : html`<span class="result" data-testid="match-bug-result">${car.resultText}</span>`;
  const parts = side === 'a' ? [chip, name, result] : [result, name, chip];
  return html`<span
    class="car"
    data-side=${side}
    data-outcome=${car.outcome}
    data-testid=${`match-bug-car-${side}`}
    >${parts}</span
  >`;
}

/** The round line: the round's name and, for a series, its tag ("MD3"). */
function renderRoundLine(match: MatchBugMatchLook): TemplateResult {
  const roundName =
    match.roundName === undefined
      ? nothing
      : html`<span class="round-name scrolling-text-box" data-testid="match-bug-round"
          >${renderScrollingText(match.roundName)}</span
        >`;
  const seriesTag =
    match.seriesTag === undefined
      ? nothing
      : html`<span class="series-tag" data-testid="match-bug-series">${match.seriesTag}</span>`;
  return html`<span class="round-line">${roundName}${seriesTag}</span>`;
}

/** The panel's content: the round line over the two cars, car A first. */
function renderMatch(match: MatchBugMatchLook): TemplateResult {
  const [carA, carB] = match.cars;
  return html`${renderRoundLine(match)}
    <span class="cars-line"
      >${renderCar(carA, 'a')}<span class="versus">${ptBR.versusMark}</span
      >${renderCar(carB, 'b')}</span
    >`;
}

/**
 * The match bug's markup: before load (no look yet) an empty panel, invisible until
 * played; after that the panel in its corner, with the match, or empty and hidden when
 * there is none to show.
 */
export function renderMatchBugTemplate(look: MatchBugLook | undefined): TemplateResult {
  if (look === undefined) {
    return html`<div class="match-bug" data-testid="match-bug-panel" data-has-match="false"></div>`;
  }
  const cornerOffsets = describeScreenCornerPosition(
    look.corner,
    chooseInsetOfTheCorner(look.corner),
  );
  const hasMatch = look.match !== undefined;
  return html`<div
    class="match-bug"
    data-testid="match-bug-panel"
    data-has-match=${hasMatch ? 'true' : 'false'}
    style=${styleMap(cornerOffsets)}
  >
    ${look.match === undefined ? nothing : renderMatch(look.match)}
  </div>`;
}

/** Finds the panel in the rendered template; a missing one is a bug in the template. */
export function findMatchBugPanel(renderRoot: ParentNode): HTMLElement {
  const panel = renderRoot.querySelector<HTMLElement>('[data-testid="match-bug-panel"]');
  if (panel === null) {
    throw new Error('the match bug panel is missing from the template; this is a bug');
  }
  return panel;
}
