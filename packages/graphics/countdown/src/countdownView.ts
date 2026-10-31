/**
 * The countdown's DOM, drawn by Lit from the data, in one of two layouts (the design's
 * `countdown` and `countdown-tela-cheia` pages, PR #21):
 * - `card`: the race clock's card without the band, top-right on the clock layer: the
 *   session in the head, "LARGADA EM" over the count, the start time where the laps go;
 * - `fullscreen`: the narrow waiting board: the kit's head ("PRÓXIMA SESSÃO", the event,
 *   the date) over a body card with the session, the count at 160 px and the start time.
 * The count's element is in the template with no binding, so Lit never writes it: the
 * kit's countdownClock does, at the server-aligned "now". Lit keeps the elements across
 * redraws of one layout, so the animations' inline styles survive an update on air; a
 * change of layout draws the other layout's elements, which the graphic places at once.
 */
import { renderBoardHead } from '@bajaovrlay/graphics-kit/boardHead';
import { writeTimeOfDayText } from '@bajaovrlay/graphics-kit/countdownText';
import { renderScrollingText } from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
// The white logo lives in the theme package; Vite bundles a copy into this graphic's dist/.
import logoAddress from '@bajaovrlay/theme/brand/logo-branca.png';
import { html, type TemplateResult } from 'lit';

import { type CountdownData, listCountdownHeadLines } from './countdownModel.js';
import { ptBR } from './ptBR.js';

/** The card: the race clock's head and body, with the count where the time goes. */
function renderCountdownCard(data: CountdownData): TemplateResult {
  const timeOfDay = writeTimeOfDayText(data.startsAtMs);
  return html`<section
    class="clock-card countdown-card"
    data-testid="countdown-panel"
    data-layout="card"
  >
    <header class="head">
      <img
        class="logo"
        src=${logoAddress}
        alt=${ptBR.logoAlternativeText}
        data-testid="countdown-logo"
      />
      <span class="title scrolling-text-box" data-testid="countdown-session"
        >${renderScrollingText(data.sessionName)}</span
      >
    </header>
    <div class="body">
      <span class="caption" data-testid="countdown-caption">${ptBR.cardCaption}</span>
      <span class="laps laps-as-text" data-testid="countdown-start"
        >${ptBR.cardStartTime(timeOfDay)}</span
      >
      <span class="time" data-testid="countdown-count"></span>
    </div>
  </section>`;
}

/** The waiting screen: the board's head, then the body card with the session and the count. */
function renderCountdownBoard(data: CountdownData): TemplateResult {
  const timeOfDay = writeTimeOfDayText(data.startsAtMs);
  const headLines = listCountdownHeadLines(data);
  return html`<section class="board" data-testid="countdown-panel" data-layout="fullscreen">
    ${renderBoardHead({
      testIdPrefix: 'countdown',
      logoAlternativeText: ptBR.logoAlternativeText,
      title: ptBR.fullscreenTitle,
      subtitle: headLines.eventLine,
      aside: headLines.dateLine,
    })}
    <div class="card countdown-body" data-testid="countdown-body">
      <span class="countdown-session scrolling-text-box" data-testid="countdown-session"
        >${renderScrollingText(data.sessionName)}</span
      >
      <span class="countdown-count" data-testid="countdown-count"></span>
      <span class="countdown-start" data-testid="countdown-start"
        >${ptBR.fullscreenStartTime(timeOfDay)}</span
      >
    </div>
  </section>`;
}

/**
 * The countdown's markup for the data; before load (no data yet) an empty card, invisible
 * until played. data-testid names are how code and tests find parts; the session, the
 * count and the start keep their names in both layouts.
 */
export function renderCountdownTemplate(data: CountdownData | undefined): TemplateResult {
  if (data === undefined) {
    return html`<section
      class="clock-card countdown-card"
      data-testid="countdown-panel"
    ></section>`;
  }
  return data.layout === 'card' ? renderCountdownCard(data) : renderCountdownBoard(data);
}

/** The elements the animations move: the card alone, or the board's head and body card. */
export type CountdownPieces = { tokensSource: HTMLElement; piecesInOrder: HTMLElement[] };

/** Finds the pieces of the layout on the page; a missing one is a bug in the template. */
export function findCountdownPieces(renderRoot: ParentNode): CountdownPieces {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`countdown part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  const panel = findPart('countdown-panel');
  if (panel.dataset.layout === 'fullscreen') {
    return {
      tokensSource: panel,
      piecesInOrder: [findPart('countdown-head'), findPart('countdown-body')],
    };
  }
  return { tokensSource: panel, piecesInOrder: [panel] };
}

/** Finds the count's element, which the countdown clock writes; undefined before load. */
export function findCountdownCount(renderRoot: ParentNode): HTMLElement | undefined {
  return renderRoot.querySelector<HTMLElement>('[data-testid="countdown-count"]') ?? undefined;
}
