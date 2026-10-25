/**
 * The message ticker's DOM: the bar Lit draws once (the kit's clock block, the label pill,
 * the message box with its two message pills, the page cell), and the functions that
 * afterwards write the label, the messages, the page cell and the block's switch in place.
 *
 * Two message pills lie on top of each other, because a page turn lifts the old message
 * away while the new one rises into the same place (motion.md, "Message ticker"): the next
 * message is written on the pill that is not on air, both move at once, and the pills then
 * trade roles, so the bar is never empty.
 */
import {
  type ClockBlockParts,
  findClockBlockParts,
  renderClockBlockTemplate,
} from '@bajaovrlay/graphics-kit/clockBlock';
import { writeTextIfChanged } from '@bajaovrlay/graphics-kit/textInPlace';
import { html, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';

/** The elements of the bar that change after the first render. */
export type MessageTickerParts = {
  bar: HTMLElement;
  clockBlock: ClockBlockParts;
  labelPill: HTMLElement;
  label: HTMLElement;
  /** The two message pills, which trade roles at every page turn. */
  messagePills: [HTMLElement, HTMLElement];
  pageCell: HTMLElement;
};

/** The bar's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderMessageTickerTemplate(): TemplateResult {
  return html`<section
    class="message-ticker bar"
    data-testid="message-ticker-bar"
    data-clock-block="shown"
  >
    ${renderClockBlockTemplate()}
    <div class="pages">
      <div class="label-pill" data-testid="message-ticker-label-pill">
        <span class="label" data-testid="message-ticker-label"></span>
      </div>
      <div class="messages">
        <div class="message" data-testid="message-ticker-message"></div>
        <div class="message" data-testid="message-ticker-message" aria-hidden="true"></div>
      </div>
    </div>
    <div class="page-cell" data-testid="message-ticker-page-cell"></div>
  </section>`;
}

/** Finds one part by its test id; a missing one is a bug in the template. */
function findPart(renderRoot: ParentNode, testId: string): HTMLElement {
  const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (part === null) {
    throw new Error(`message ticker part "${testId}" is missing from the template; this is a bug`);
  }
  return part;
}

/** Finds every part in the rendered template. */
export function findMessageTickerParts(renderRoot: ParentNode): MessageTickerParts {
  const [firstMessagePill, secondMessagePill] = [
    ...renderRoot.querySelectorAll<HTMLElement>('[data-testid="message-ticker-message"]'),
  ];
  if (firstMessagePill === undefined || secondMessagePill === undefined) {
    throw new Error('a message pill of the ticker is missing from the template; this is a bug');
  }
  return {
    bar: findPart(renderRoot, 'message-ticker-bar'),
    clockBlock: findClockBlockParts(renderRoot),
    labelPill: findPart(renderRoot, 'message-ticker-label-pill'),
    label: findPart(renderRoot, 'message-ticker-label'),
    messagePills: [firstMessagePill, secondMessagePill],
    pageCell: findPart(renderRoot, 'message-ticker-page-cell'),
  };
}

/** Writes the label pill ("AVISO"). */
export function writeLabel(parts: MessageTickerParts, label: string): void {
  writeTextIfChanged(parts.label, label);
}

/** Writes a message on one of the two message pills. */
export function writeMessageOnPill(pill: HTMLElement, message: string): void {
  writeTextIfChanged(pill, message);
}

/**
 * Makes one message pill the one on air for assistive technology; the other, empty or
 * lifting away, is hidden from it.
 */
export function markMessagePillOnAir(parts: MessageTickerParts, pillIndex: 0 | 1): void {
  const pillOnAir = parts.messagePills[pillIndex];
  const otherPill = parts.messagePills[pillIndex === 0 ? 1 : 0];
  pillOnAir.removeAttribute('aria-hidden');
  otherPill.setAttribute('aria-hidden', 'true');
}

/** Writes the page cell: "1/3", named "aviso 1 de 3" for assistive technology. */
export function writePageCell(parts: MessageTickerParts, pageNumber: number, pageCount: number) {
  writeTextIfChanged(parts.pageCell, `${pageNumber}/${pageCount}`);
  parts.pageCell.setAttribute('aria-label', ptBR.pageCellName(pageNumber, pageCount));
}
