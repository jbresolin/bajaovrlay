/**
 * Test support for the scrolling text clock's tests (scrollingTextWhenTooLong.test.ts and
 * scrollingTextWhenTooLong.changes.test.ts): a graphic's shadow root with boxes whose widths
 * the test sets (jsdom lays nothing out), a ResizeObserver the test drives (jsdom has none),
 * and the reads and moves of the cycle's GSAP timeline. No graphic's module imports this.
 */
import { gsap } from 'gsap';
import { expect, onTestFinished, vi } from 'vitest';

import type { ScrollingTextClock } from './scrollingTextWhenTooLong.js';
import {
  createScrollingTextClock,
  makeScrollingTextBox,
  writeScrollingTextIfChanged,
} from './scrollingTextWhenTooLong.js';

/** Ardósia's text timings, set on the graphic's element as the renderer's :root would. */
export const ardosiaTextTokens: Record<string, string> = {
  '--motion-text-hold-start': '2500ms',
  '--motion-text-scroll-speed': '60',
  '--motion-text-hold-end': '1500ms',
  '--motion-text-return': '250ms',
  '--motion-text-edge-fade': '24',
};

/** The same timings as numbers, for the pure cycle the timeline must agree with. */
export const ardosiaTextTimings = {
  holdStartMs: 2500,
  scrollSpeedPxPerSecond: 60,
  holdEndMs: 1500,
  returnMs: 250,
  edgeFadePx: 24,
};

/** A box on the test page whose widths the test sets, as layout would in a browser. */
export type MeasuredBox = {
  box: HTMLElement;
  text: HTMLElement;
  widths: { textWidthPx: number; boxWidthPx: number };
};

/** A graphic's host with an open shadow root, the theme's text tokens on it. */
export function createGraphicHostWithShadowRoot(): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('section');
  for (const [tokenName, value] of Object.entries(ardosiaTextTokens)) {
    host.style.setProperty(tokenName, value);
  }
  document.body.append(host);
  onTestFinished(() => host.remove());
  const root = host.attachShadow({ mode: 'open' });
  return { host, root };
}

/** Adds a tower row's team box holding `teamName`, with the widths layout would give it. */
export function addTeamNameBox(
  root: ShadowRoot,
  teamName: string,
  widths: { textWidthPx: number; boxWidthPx: number },
): MeasuredBox {
  const box = document.createElement('span');
  box.className = 'team-name';
  root.append(box);
  const text = makeScrollingTextBox(box);
  writeScrollingTextIfChanged(box, teamName);
  const measuredBox: MeasuredBox = { box, text, widths: { ...widths } };
  // jsdom lays nothing out: the widths are read from the test's own numbers, which a test
  // may change later as a live update or a resize would.
  Object.defineProperty(text, 'offsetWidth', {
    configurable: true,
    get: () => measuredBox.widths.textWidthPx,
  });
  Object.defineProperty(box, 'clientWidth', {
    configurable: true,
    get: () => measuredBox.widths.boxWidthPx,
  });
  return measuredBox;
}

/**
 * A ResizeObserver the test drives: jsdom has none. `reportResizeOf` calls the clock back
 * as a browser would after a box changed size.
 */
export function installHandDrivenResizeObserver(): { reportResizeOf: (element: Element) => void } {
  const callbacks: ResizeObserverCallback[] = [];
  class HandDrivenResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      callbacks.push(callback);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {
      const index = callbacks.indexOf(this.callback);
      if (index >= 0) {
        callbacks.splice(index, 1);
      }
    }
  }
  vi.stubGlobal('ResizeObserver', HandDrivenResizeObserver);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  function reportResizeOf(element: Element): void {
    const entry = { target: element } as unknown as ResizeObserverEntry;
    for (const callback of [...callbacks]) {
      callback([entry], {} as ResizeObserver);
    }
  }
  return { reportResizeOf };
}

/** Starts a clock over the graphic, stopped again when the test ends. */
export function startClockOverGraphic(host: HTMLElement, root: ShadowRoot): ScrollingTextClock {
  const clock = createScrollingTextClock({ root, tokensSource: host });
  onTestFinished(() => clock.stop());
  clock.start();
  return clock;
}

/** The GSAP timelines running at the top level: the clock's cycle, when there is one. */
export function findRunningCycleTimelines(): gsap.core.Timeline[] {
  return gsap.globalTimeline
    .getChildren(false, false, true)
    .filter((child): child is gsap.core.Timeline => child instanceof gsap.core.Timeline);
}

/** The one cycle timeline running, paused so only the test moves it. */
export function pauseTheOneCycleTimeline(): gsap.core.Timeline {
  const timelines = findRunningCycleTimelines();
  expect(timelines.length, 'exactly one cycle timeline must be running').toBe(1);
  const [timeline] = timelines;
  if (timeline === undefined) {
    throw new Error('no cycle timeline');
  }
  timeline.pause();
  return timeline;
}

/** Moves a paused timeline to `momentMs`, firing the phase changes on its way. */
export function moveTimelineTo(timeline: gsap.core.Timeline, momentMs: number): void {
  timeline.seek(momentMs / 1000, false);
}

/** How far GSAP has moved a text, in pixels (0 at its start). */
export function readTextOffsetPx(text: HTMLElement): number {
  return Number(gsap.getProperty(text, 'x'));
}

/** Lets the MutationObserver deliver what the test just changed. */
export async function letTheClockSeeTheChange(): Promise<void> {
  await Promise.resolve();
}

/** Ends every timeline the test left, so GSAP's global timeline is empty for the next test. */
export function endLeftoverTimelinesWhenTheTestEnds(): void {
  onTestFinished(() => {
    for (const timeline of findRunningCycleTimelines()) {
      timeline.kill();
    }
  });
}
