/**
 * A scrolling text box (BAJAOVRLAY-55): any element of a graphic marked
 * `scrolling-text-box`, holding one `scrolling-text` element with the text, made with
 * makeScrollingTextBox (a graphic that writes its own DOM) or renderScrollingText (a Lit
 * template). The box clips; the text inside is one line, as wide as it needs
 * (scrollingTextStyles.ts). The graphic's clock (scrollingTextWhenTooLong.ts) finds the
 * boxes and measures them with the two helpers at the end.
 */
import { html, type TemplateResult } from 'lit';

import type { ScrollingTextMeasure } from './scrollingTextCycle.js';
import { writeTextIfChanged } from './textInPlace.js';

/** The class that marks a clipped box; the clock finds the boxes by it. */
const boxClassName = 'scrolling-text-box';

/** The class of the one text element inside a box, the element that moves. */
export const textClassName = 'scrolling-text';

/** A box and its text, as the clock finds them at a cycle start. */
export type ScrollingTextPart = { box: HTMLElement; text: HTMLElement };

/**
 * Makes `box` a scrolling text box for a graphic that writes its own DOM (the tower's
 * rows): marks it and wraps what it holds (a text, or a team name and its school that
 * scroll as one line) in the one text element, which it answers. Write a plain text with
 * writeScrollingTextIfChanged.
 */
export function makeScrollingTextBox(box: HTMLElement): HTMLElement {
  const existingText = findTextOfBox(box);
  if (existingText !== undefined) {
    return existingText;
  }
  box.classList.add(boxClassName);
  const text = document.createElement('span');
  text.className = textClassName;
  text.append(...box.childNodes);
  box.append(text);
  return text;
}

/** Writes `text` into a scrolling text box, only when it differs (textInPlace's rule). */
export function writeScrollingTextIfChanged(box: HTMLElement, text: string): void {
  const textElement = makeScrollingTextBox(box);
  writeTextIfChanged(textElement, text);
}

/**
 * The text element of a scrolling box, for a Lit template: the box around it carries the
 * class `scrolling-text-box` (written in the graphic's template, with its own classes).
 */
export function renderScrollingText(text: string): TemplateResult {
  return html`<span class="${textClassName}">${text}</span>`;
}

/** The text element directly inside a box, if the box has one. */
function findTextOfBox(box: Element): HTMLElement | undefined {
  for (const child of box.children) {
    if (child instanceof HTMLElement && child.classList.contains(textClassName)) {
      return child;
    }
  }
  return undefined;
}

/** Every box of the graphic with its text element, in document order (the clock's). */
export function findScrollingTextParts(root: ParentNode): ScrollingTextPart[] {
  const parts: ScrollingTextPart[] = [];
  for (const box of root.querySelectorAll<HTMLElement>(`.${boxClassName}`)) {
    const text = findTextOfBox(box);
    if (text !== undefined) {
      parts.push({ box, text });
    }
  }
  return parts;
}

/**
 * The widths the cycle needs: the text's, and the room the box gives it (its width inside
 * its padding, where the text starts and must end). offsetWidth and clientWidth ignore
 * transforms, so a text mid-scroll or a row mid-slide measures the same as at rest. A
 * hidden box measures 0 and so fits.
 */
export function measurePart(part: ScrollingTextPart): ScrollingTextMeasure {
  const boxStyle = getComputedStyle(part.box);
  const paddingPx = readPixels(boxStyle.paddingLeft) + readPixels(boxStyle.paddingRight);
  const boxWidthPx = part.box.clientWidth - paddingPx;
  return { textWidthPx: part.text.offsetWidth, boxWidthPx };
}

/** A computed length in pixels; an empty or unreadable one (jsdom's) is 0. */
function readPixels(computedLength: string): number {
  const pixels = Number.parseFloat(computedLength);
  return Number.isNaN(pixels) ? 0 : pixels;
}
