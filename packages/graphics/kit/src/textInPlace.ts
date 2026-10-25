/**
 * Writing a text into an element that is already on the page, the way every graphic
 * updates on air: only when it differs, so an unchanged update or a clock frame touches
 * nothing (no layout, no repaint). Six graphics had their own copy until BAJAOVRLAY-23.
 */

/** Changes an element's text only when it differs from what is there. */
export function writeTextIfChanged(element: Element, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}
