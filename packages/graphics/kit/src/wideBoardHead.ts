/**
 * The head card of a wide board (the standings, the podium): the organiser's logo, the
 * title, the event line and a line at the right (the standings' page, the podium's step),
 * the design's `.board__head` (docs/design/tools/slate-boards.css). Two graphics draw it,
 * so its markup and writer live here and its look in wideBoardHeadStyles.ts; each graphic
 * keeps its own board around it.
 *
 * The test ids carry the graphic's own prefix (`standings-head`, `podium-head`), so each
 * graphic's tests and e2e find the head by the names they always used.
 */
// The white logo lives in the theme package; Vite bundles a copy into the dist/assets/ of
// each graphic that draws the head, so the built graphic works from the preview and the air.
import logoAddress from '@bajaovrlay/theme/brand/logo-branca.png';
import { html, type TemplateResult } from 'lit';

/** The elements of the head that change after the first render. */
export type WideBoardHeadParts = {
  head: HTMLElement;
  title: HTMLElement;
  eventLine: HTMLElement;
  pageLine: HTMLElement;
};

/** What a graphic's head says: the title, the event line ('' for none), the line at the right. */
export type WideBoardHeadTexts = {
  title: string;
  eventLine: string;
  pageLine: string;
};

/**
 * The head's markup, drawn once inside the graphic's board. `testIdPrefix` names the
 * graphic ("standings"); `logoAlternativeText` comes from the graphic's pt-BR catalog.
 */
export function renderWideBoardHeadTemplate(
  testIdPrefix: string,
  logoAlternativeText: string,
): TemplateResult {
  return html`<header class="wide-board-head" data-testid=${`${testIdPrefix}-head`}>
    <img class="wide-board-head-logo" src=${logoAddress} alt=${logoAlternativeText} />
    <h1 class="wide-board-head-title" data-testid=${`${testIdPrefix}-title`}></h1>
    <span class="wide-board-head-event-line" data-testid=${`${testIdPrefix}-event-line`}></span>
    <span class="wide-board-head-page-line" data-testid=${`${testIdPrefix}-page-line`}></span>
  </header>`;
}

/** Finds the head's parts in the rendered template; a missing one is a bug in the template. */
export function findWideBoardHeadParts(
  renderRoot: ParentNode,
  testIdPrefix: string,
): WideBoardHeadParts {
  const findPart = (testIdSuffix: string): HTMLElement => {
    const testId = `${testIdPrefix}-${testIdSuffix}`;
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`board head part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    head: findPart('head'),
    title: findPart('title'),
    eventLine: findPart('event-line'),
    pageLine: findPart('page-line'),
  };
}

/**
 * Writes the head's texts: the event line is left out when it is empty, so the line at the
 * right keeps its place at the right. The card itself never moves.
 */
export function writeWideBoardHead(parts: WideBoardHeadParts, texts: WideBoardHeadTexts): void {
  parts.title.textContent = texts.title;
  parts.eventLine.textContent = texts.eventLine;
  parts.eventLine.hidden = texts.eventLine === '';
  parts.pageLine.textContent = texts.pageLine;
}
