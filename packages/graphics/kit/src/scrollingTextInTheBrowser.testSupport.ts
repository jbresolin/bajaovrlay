/**
 * Test support for the Playwright tests of the graphics' long texts (BAJAOVRLAY-55): the
 * tower, the standings, the lower third, the team card and the bracket. No graphic's own
 * module imports this file.
 *
 * Two sets of theme tokens put a scrolling text where the test wants it without waiting on
 * the real 2.5 s hold: one keeps it resting at its start for ten minutes, the other scrolls
 * it to its end at once and keeps it there for ten minutes. A test waits on the box's
 * `data-scroll-phase` (the thing itself, never the clock) and then measures the box and the
 * text inside it with getBoundingClientRect, which, unlike offsetWidth, sees the scroll.
 */
import { expect, type Locator } from '@playwright/test';

/** The real long names of the Baja field the tests write into the graphics. */
export const longestBajaSchoolNames = {
  utfprCornelioProcopio: 'Universidade Tecnológica Federal do Paraná - Cornélio Procópio',
  iffItaperuna:
    'Instituto Federal de Educação, Ciência e Tecnologia Fluminense - IFF - Campus Itaperuna',
};

/** Tokens that hold a long text at its start for ten minutes: the rest a viewer first sees. */
export const textTokensHoldingAtTheStart: Record<string, string> = {
  '--motion-text-hold-start': '600000ms',
};

/** Tokens that scroll a long text to its end almost at once and hold it there ten minutes. */
export const textTokensScrollingToTheEndAtOnce: Record<string, string> = {
  '--motion-text-hold-start': '1ms',
  '--motion-text-scroll-speed': '20000',
  '--motion-text-hold-end': '600000ms',
};

/** Ardósia's edge fade, which the scroll goes past so the last letter clears it. */
export const ardosiaEdgeFadePx = 24;

/** Where a scrolling box and its text are on the page, in CSS pixels. */
export type ScrollingBoxPlace = {
  boxLeft: number;
  boxRight: number;
  boxWidth: number;
  textLeft: number;
  textRight: number;
};

/** Measures a scrolling box (the locator) and the text inside it, transforms included. */
export async function measureScrollingBox(box: Locator): Promise<ScrollingBoxPlace> {
  return box.evaluate((boxElement) => {
    const textElement = boxElement.querySelector(':scope > .scrolling-text');
    if (textElement === null) {
      throw new Error('the box holds no .scrolling-text: it is not a scrolling box');
    }
    const boxRectangle = boxElement.getBoundingClientRect();
    const textRectangle = textElement.getBoundingClientRect();
    return {
      boxLeft: boxRectangle.left,
      boxRight: boxRectangle.right,
      boxWidth: boxRectangle.width,
      textLeft: textRectangle.left,
      textRight: textRectangle.right,
    };
  });
}

/** Waits until the box names the phase (`data-scroll-phase`). */
export async function waitForScrollPhase(box: Locator, phase: string): Promise<void> {
  await expect(box, `the box must reach the "${phase}" phase`).toHaveAttribute(
    'data-scroll-phase',
    phase,
  );
}

/**
 * Checks a box resting at its start: the text begins at the box's left edge (its start
 * shows, padding aside) and runs past its right edge (it is too long: cut, not ellipsed).
 */
export function expectTextStartShowing(place: ScrollingBoxPlace, paddingLeftPx = 0): void {
  expect(
    Math.abs(place.textLeft - (place.boxLeft + paddingLeftPx)),
    "the text's start must show at the box's left edge",
  ).toBeLessThan(1);
  expect(place.textRight, 'the text must be too long for its box').toBeGreaterThan(place.boxRight);
}

/**
 * Checks a box at the end of its scroll: the text's end shows inside the box, clear of the
 * edge fade but no further than the fade's width from the edge, and its start is cut off.
 */
export function expectTextEndShowing(place: ScrollingBoxPlace, paddingRightPx = 0): void {
  const visibleRight = place.boxRight - paddingRightPx;
  expect(place.textRight, "the text's end must show inside the box").toBeLessThanOrEqual(
    visibleRight - ardosiaEdgeFadePx + 1,
  );
  expect(place.textRight, "the text's end must come to rest at the fade").toBeGreaterThan(
    visibleRight - ardosiaEdgeFadePx - 1,
  );
  expect(place.textLeft, "the text's start must have scrolled out").toBeLessThan(place.boxLeft);
}
