/**
 * Test support for every graphic's tests of its scrolling texts in jsdom (BAJAOVRLAY-55):
 * no graphic's own module imports this file.
 *
 * jsdom lays nothing out, so every text measures 0 px and fits: a graphic's clock would
 * never start a cycle there. `makeEveryScrollingTextTooLongForItsBox` makes every
 * scrolling text 876 px wide in a 300 px box (the length of "INSTITUTO FEDERAL DE
 * EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA" in a tower row) for
 * one test, so a test can prove the cycle starts on air and ends on stop and dispose.
 */
import { gsap } from 'gsap';
import { onTestFinished } from 'vitest';

import { scrollingTextCycleTimelineData } from './scrollingTextWhenTooLong.js';

/** Makes every scrolling text too long for its box, for the rest of the test. */
export function makeEveryScrollingTextTooLongForItsBox(): void {
  const realOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  const realClientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('scrolling-text') ? 876 : 0;
    },
  });
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element) {
      return this.classList.contains('scrolling-text-box') ? 300 : 0;
    },
  });
  onTestFinished(() => {
    if (realOffsetWidth !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffsetWidth);
    }
    if (realClientWidth !== undefined) {
      Object.defineProperty(Element.prototype, 'clientWidth', realClientWidth);
    }
  });
}

/** The scrolling text cycles running: one per graphic on air with a text too long. */
export function findRunningScrollingTextCycles(): gsap.core.Timeline[] {
  return gsap.globalTimeline
    .getChildren(false, false, true)
    .filter((child): child is gsap.core.Timeline => child instanceof gsap.core.Timeline)
    .filter((timeline) => timeline.data === scrollingTextCycleTimelineData);
}

/** Ends every scrolling text cycle left running when the test ends, so none leaks. */
export function killScrollingTextCyclesWhenTheTestEnds(): void {
  onTestFinished(() => {
    for (const timeline of findRunningScrollingTextCycles()) {
      timeline.kill();
    }
  });
}
