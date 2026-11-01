/**
 * The QR card's DOM, drawn by Lit from the data: the code's box with the code in it, then
 * the call to action over the address. The code is an inline SVG of one path, drawn in
 * module units and sized in whole px by the drawing plan (qrCodeLayout.ts), with
 * `shape-rendering: crispEdges` so no module edge is smoothed into grey. Lit keeps the card
 * element itself across redraws, so the animations' inline styles on it survive an update.
 */
import { renderScrollingText } from '@bajaovrlay/graphics-kit/scrollingTextBox';
import { html, svg, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';
import type { QrCardData } from './qrCardModel.js';
import { quietZoneModules } from './qrCodeEncoding.js';
import { buildQrCodePathData, type QrCodeDrawingPlan } from './qrCodeLayout.js';

/** What the view draws: the data, the code's squares and how they sit in the box. */
export type QrCardDrawing = {
  data: QrCardData;
  modules: boolean[][];
  plan: QrCodeDrawingPlan;
};

/**
 * The code: the viewBox starts one quiet zone before the first module, so the light margin
 * is part of the drawing, and the SVG's px size is a whole multiple of its units.
 */
function renderCode(drawing: QrCardDrawing): TemplateResult {
  const { modules, plan, data } = drawing;
  const viewBoxStart = -quietZoneModules;
  const viewBoxSize = modules.length + 2 * quietZoneModules;
  const sizeAndPlace = `width: ${plan.drawnSizePx}px; height: ${plan.drawnSizePx}px; margin: ${plan.offsetPx}px 0 0 ${plan.offsetPx}px;`;
  return html`<svg
    class="code"
    data-testid="qr-card-code"
    data-module-count=${modules.length}
    viewBox="${viewBoxStart} ${viewBoxStart} ${viewBoxSize} ${viewBoxSize}"
    style=${sizeAndPlace}
    shape-rendering="crispEdges"
    role="img"
    aria-label=${ptBR.codeAlternativeText(data.address)}
  >
    ${svg`<path d=${buildQrCodePathData(modules)} fill="currentColor"></path>`}
  </svg>`;
}

/**
 * The card's markup for the drawing; before load (no data yet) an empty card, invisible
 * until played. data-testid names are how code and tests find parts.
 */
export function renderQrCardTemplate(drawing: QrCardDrawing | undefined): TemplateResult {
  if (drawing === undefined) {
    return html`<section class="qr-card" data-testid="qr-card-panel"></section>`;
  }
  return html`<section class="qr-card" data-testid="qr-card-panel">
    <div class="code-box" data-testid="qr-card-code-box">${renderCode(drawing)}</div>
    <div class="text">
      <span class="call-to-action scrolling-text-box" data-testid="qr-card-call-to-action"
        >${renderScrollingText(drawing.data.callToAction)}</span
      >
      <span class="address scrolling-text-box" data-testid="qr-card-address"
        >${renderScrollingText(drawing.data.address)}</span
      >
    </div>
  </section>`;
}

/** Finds the card element in the rendered template; a missing one is a bug in the template. */
export function findQrCardPanel(renderRoot: ParentNode): HTMLElement {
  const panel = renderRoot.querySelector<HTMLElement>('[data-testid="qr-card-panel"]');
  if (panel === null) {
    throw new Error('the QR card element is missing from the template; this is a bug');
  }
  return panel;
}
