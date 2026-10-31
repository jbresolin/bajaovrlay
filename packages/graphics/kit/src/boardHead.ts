/**
 * The narrow boards' head card (BAJAOVRLAY-46): the waiting screen, the sessions board, the
 * intermission and the sponsor roll open with the design's `board__head` (PR #21,
 * docs/design/tools/slateBoards.mjs's renderBoardHead): the white Baja SAE Brasil logo, the
 * title, a subtitle and a line at the right. A part with nothing to show is not in the
 * template, never an empty box. Lit keeps the head element across redraws, so the
 * animations' inline styles on it survive an update on air, and a changed subtitle (the
 * sponsor roll's level, page by page) changes in place. Its look is boardStyles.ts's.
 *
 * What could go wrong: GSAP, reading the transform of an element that has no offsetParent
 * (always in jsdom; in Chromium under a hidden ancestor), takes it out of the page and puts
 * it back before its next element sibling, which skips Lit's comment markers and corrupts
 * the template's parts. So the head card GSAP animates sits alone inside a wrapper
 * (`display: contents`, no box of its own), and the wrapper is what a board's template
 * holds.
 *
 * The logo is `<img src>` and nothing else, bundled from the theme package by Vite into
 * each graphic's dist/.
 */
import logoAddress from '@bajaovrlay/theme/brand/logo-branca.png';
import { html, nothing, type TemplateResult } from 'lit';

import { renderScrollingText } from './scrollingTextWhenTooLong.js';

/** What a board's head shows; `testIdPrefix` starts every part's data-testid. */
export type BoardHeadContent = {
  /** The board's name in test ids: "sessions-board" gives "sessions-board-title". */
  testIdPrefix: string;
  /** The logo's alternative text, from the board's pt-BR catalog. */
  logoAlternativeText: string;
  /** "PROGRAMAÇÃO DO DIA", "INTERVALO", "PATROCINADORES". */
  title: string;
  /** The event line, or the page's sponsor level; left out, no subtitle. */
  subtitle?: string | undefined;
  /** The date, or the page line ("1/5"); left out, nothing at the right. */
  aside?: string | undefined;
};

/** The head card's markup for this content. */
export function renderBoardHead(content: BoardHeadContent): TemplateResult {
  const prefix = content.testIdPrefix;
  const subtitle =
    content.subtitle === undefined
      ? nothing
      : html`<span
          class="caption board-subtitle scrolling-text-box"
          data-testid="${prefix}-subtitle"
          >${renderScrollingText(content.subtitle)}</span
        >`;
  const aside =
    content.aside === undefined
      ? nothing
      : html`<span class="board-aside" data-testid="${prefix}-aside">${content.aside}</span>`;
  return html`<div class="board-head-place">
    <header class="card board-head" data-testid="${prefix}-head">
      <img
        class="board-logo"
        src=${logoAddress}
        alt=${content.logoAlternativeText}
        data-testid="${prefix}-logo"
      />
      <h1 class="board-title" data-testid="${prefix}-title">${content.title}</h1>
      ${subtitle}${aside}
    </header>
  </div>`;
}
