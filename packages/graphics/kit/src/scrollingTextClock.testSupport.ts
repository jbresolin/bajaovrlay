/**
 * Test support for the scrolling text clock's tests (scrollingTextWhenTooLong.test.ts and
 * scrollingTextWhenTooLong.changes.test.ts): a graphic's shadow root with boxes whose widths
 * the test sets (jsdom lays nothing out), a ResizeObserver the test drives (jsdom has none),
 * the clock's timers under the test's hand, and the Web Animations it starts recorded
 * (jsdom has none). No graphic's module imports this.
 */
import { expect, onTestFinished, vi } from 'vitest';

import { makeScrollingTextBox, writeScrollingTextIfChanged } from './scrollingTextBox.js';
import type { ScrollingTextClock } from './scrollingTextWhenTooLong.js';
import { createScrollingTextClock } from './scrollingTextWhenTooLong.js';
import {
  findLastAnimationOf,
  installRecordingWebAnimations,
  type RecordedAnimation,
} from './webAnimationsInJsdom.testSupport.js';

/** Ardósia's text timings, set on the graphic's element as the renderer's :root would. */
export const ardosiaTextTokens: Record<string, string> = {
  '--motion-text-hold-start': '2500ms',
  '--motion-text-scroll-speed': '60',
  '--motion-text-hold-end': '1500ms',
  '--motion-text-return': '250ms',
  '--motion-text-edge-fade': '24',
};

/** The same timings as numbers, for the pure cycle the clock must follow. */
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

/** The hand-driven ResizeObserver: how a test reports a resize and reads what is watched. */
export type HandDrivenResizeObserver = {
  /** Calls the clock back as a browser would after `element` changed size. */
  reportResizeOf: (element: Element) => void;
  /** The elements being watched now: observed and not unobserved since. */
  listWatchedElements: () => Element[];
};

/** A ResizeObserver the test drives: jsdom has none. */
export function installHandDrivenResizeObserver(): HandDrivenResizeObserver {
  const callbacks: ResizeObserverCallback[] = [];
  const watchedElements = new Set<Element>();
  class HandDrivenResizeObserverStandIn {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      callbacks.push(callback);
    }
    observe(element: Element): void {
      watchedElements.add(element);
    }
    unobserve(element: Element): void {
      watchedElements.delete(element);
    }
    disconnect(): void {
      watchedElements.clear();
      const index = callbacks.indexOf(this.callback);
      if (index >= 0) {
        callbacks.splice(index, 1);
      }
    }
  }
  vi.stubGlobal('ResizeObserver', HandDrivenResizeObserverStandIn);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  function reportResizeOf(element: Element): void {
    const entry = { target: element } as unknown as ResizeObserverEntry;
    for (const callback of [...callbacks]) {
      callback([entry], {} as ResizeObserver);
    }
  }
  return { reportResizeOf, listWatchedElements: () => [...watchedElements] };
}

/**
 * Takes the clock's timers into the test's hands (setTimeout only: the MutationObserver
 * still delivers on its own) and records the animations it starts; both undone after.
 */
export function takeControlOfTimeAndAnimations(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  installRecordingWebAnimations();
}

/** Starts a clock over the graphic, stopped again when the test ends. */
export function startClockOverGraphic(host: HTMLElement, root: ShadowRoot): ScrollingTextClock {
  const clock = createScrollingTextClock({ root, tokensSource: host });
  onTestFinished(() => clock.stop());
  clock.start();
  return clock;
}

/** Lets the cycle run on by `durationMs`, firing the clock's timers on the way. */
export function letTheCycleRunFor(durationMs: number): void {
  vi.advanceTimersByTime(durationMs);
}

/** The animation the clock gave a text last, which the test expects to exist. */
export function readAnimationOf(text: HTMLElement): RecordedAnimation {
  const animation = findLastAnimationOf(text);
  expect(animation, 'the clock must have animated this text').toBeDefined();
  if (animation === undefined) {
    throw new Error('no animation');
  }
  return animation;
}

/** Lets the MutationObserver deliver what the test just changed. */
export async function letTheClockSeeTheChange(): Promise<void> {
  await Promise.resolve();
}
