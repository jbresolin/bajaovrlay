/**
 * The battle card's DOM, drawn by Lit from what is on screen: the car ahead's pill, the gap
 * card and the car behind's pill, bottom-centre, as the design's battle-card page draws
 * them. Lit keeps every element across redraws and writes only the texts that changed, so
 * a new gap or a new lap count changes in place, never re-entering, and the animations'
 * inline styles on the pieces survive an update on air.
 *
 * The trend cell is two layers in the same place: the trend on screen and, under it, the
 * incoming one, invisible. A change of word crossfades the incoming layer in over the
 * current one (battleCardAnimations.ts); at rest the incoming layer is dressed like the
 * current one, so the cell's width never depends on which layer is showing.
 */
import { html, svg, type TemplateResult } from 'lit';

import { type BattleCar, isLeader } from './battleCardModel.js';
import { type TrendShown, type TrendWord, writeTrendWords } from './battleTrend.js';
import { ptBR } from './ptBR.js';

/** What the card shows now: both cars, the gap text, and the two layers of the trend cell. */
export type BattleCardViewState = {
  carAhead: BattleCar;
  carBehind: BattleCar;
  gapText: string;
  trendOnScreen: TrendShown;
  incomingTrend: TrendShown;
};

/** The pieces the animations move and the two trend layers they crossfade. */
export type BattleCardParts = {
  carAheadPill: HTMLElement;
  gapCard: HTMLElement;
  carBehindPill: HTMLElement;
  trendLayer: HTMLElement;
  incomingTrendLayer: HTMLElement;
};

/**
 * The shape of each trend (the design's trendIcons): ▸◂ pointing in for closing, ◂▸
 * pointing out for opening, a dash for steady, so the trend reads in a still frame and
 * never by colour alone.
 */
function renderTrendShape(word: TrendWord): TemplateResult {
  if (word === 'closing') {
    return html`<svg class="trend-shape" viewBox="0 0 24 10" aria-hidden="true">
      ${svg`<path d="M0 0l9 5-9 5z" fill="currentColor" /><path d="M24 0l-9 5 9 5z" fill="currentColor" />`}
    </svg>`;
  }
  if (word === 'opening') {
    return html`<svg class="trend-shape" viewBox="0 0 24 10" aria-hidden="true">
      ${svg`<path d="M9 0 0 5l9 5z" fill="currentColor" /><path d="M15 0l9 5-9 5z" fill="currentColor" />`}
    </svg>`;
  }
  return html`<svg class="trend-shape" viewBox="0 0 24 10" aria-hidden="true">
    ${svg`<rect x="2" y="4" width="20" height="2" fill="currentColor" />`}
  </svg>`;
}

/** One layer of the trend cell: its shape and words, coloured by its own data-trend. */
function renderTrendLayer(trend: TrendShown, testId: string, isIncoming: boolean): TemplateResult {
  return html`<span
    class=${isIncoming ? 'trend incoming' : 'trend'}
    data-testid=${testId}
    data-trend=${trend.word}
    aria-hidden=${isIncoming ? 'true' : 'false'}
    >${renderTrendShape(trend.word)}<span class="trend-words" data-testid=${`${testId}-words`}
      >${writeTrendWords(trend)}</span
    ></span
  >`;
}

/** One car's pill: position (green chip for the leader), car chip, team over school, laps. */
function renderCarPill(car: BattleCar, testIdPrefix: string): TemplateResult {
  return html`<div
    class="pill battle-car"
    data-testid=${testIdPrefix}
    ?data-leader=${isLeader(car)}
  >
    <span class="position" data-testid=${`${testIdPrefix}-position`}>${car.position}</span>
    <span class="chip" data-testid=${`${testIdPrefix}-car-number`}>${car.carNumber}</span>
    <span class="team"
      ><span class="team-name" data-testid=${`${testIdPrefix}-team-name`}>${car.teamName}</span
      ><span class="school-name" data-testid=${`${testIdPrefix}-school-name`}
        >${car.schoolName}</span
      ></span
    >
    <span class="laps" data-testid=${`${testIdPrefix}-laps`}>${ptBR.lapsText(car.laps)}</span>
  </div>`;
}

/**
 * The card's markup for what is on screen; before load (nothing yet) an empty section.
 * data-testid names are how code and tests find parts.
 */
export function renderBattleCardTemplate(state: BattleCardViewState | undefined): TemplateResult {
  if (state === undefined) {
    return html`<section class="battle-card" data-testid="battle-card"></section>`;
  }
  return html`<section class="battle-card" data-testid="battle-card">
    ${renderCarPill(state.carAhead, 'battle-card-ahead')}
    <div class="card gap-card" data-testid="battle-card-gap-card">
      <span class="gap" data-testid="battle-card-gap">${state.gapText}</span>
      <span class="trend-stack"
        >${renderTrendLayer(state.trendOnScreen, 'battle-card-trend', false)}${renderTrendLayer(
          state.incomingTrend,
          'battle-card-incoming-trend',
          true,
        )}</span
      >
    </div>
    ${renderCarPill(state.carBehind, 'battle-card-behind')}
  </section>`;
}

/** Finds one part by its test id; a missing one is a bug in the template. */
function findPartByTestId(renderRoot: ParentNode, testId: string): HTMLElement {
  const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (part === null) {
    throw new Error(`the battle card part "${testId}" is missing from the template; a bug`);
  }
  return part;
}

/** Finds the three pieces and the two trend layers in a card drawn with data. */
export function findBattleCardParts(renderRoot: ParentNode): BattleCardParts {
  return {
    carAheadPill: findPartByTestId(renderRoot, 'battle-card-ahead'),
    gapCard: findPartByTestId(renderRoot, 'battle-card-gap-card'),
    carBehindPill: findPartByTestId(renderRoot, 'battle-card-behind'),
    trendLayer: findPartByTestId(renderRoot, 'battle-card-trend'),
    incomingTrendLayer: findPartByTestId(renderRoot, 'battle-card-incoming-trend'),
  };
}
