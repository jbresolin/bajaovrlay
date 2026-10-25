/**
 * Test support for the message ticker's component tests: the element under test, its data,
 * readers for what it shows, and the hold placed on the page when a test needs it. Unless a
 * test places tokens, every timeline lasts 0 ms and the hold is the kit's 7 s fallback.
 */
import { onTestFinished, vi } from 'vitest';

import MessageTickerGraphic from './message-ticker.js';
import type { MessageTickerData } from './messageTickerModel.js';
import { createEnduroAnnouncements } from './previewData.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-message-ticker-under-test', MessageTickerGraphic);

// 14:00:00 on the enduro's day, as the server's clock read it.
export const twoInTheAfternoonMs = Date.UTC(2026, 2, 8, 17, 0, 0);

/** The enduro's three announcements under "AVISO", the clock held at 1:00:00, green. */
export function createEnduroTickerData(): MessageTickerData {
  return {
    label: 'AVISO',
    messages: createEnduroAnnouncements(),
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: twoInTheAfternoonMs,
    running: false,
  };
}

/**
 * Puts a fresh ticker element on the page, as a renderer does before calling load. When
 * the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createMessageTickerOnThePage(): MessageTickerGraphic {
  const ticker = document.createElement('baja-message-ticker-under-test') as MessageTickerGraphic;
  document.body.append(ticker);
  onTestFinished(async () => {
    await ticker.dispose();
    ticker.remove();
  });
  return ticker;
}

/** Loads the ticker the way an OBS renderer does: real-time, at 1920x1080. */
export function loadMessageTickerWithData(ticker: MessageTickerGraphic, data: unknown) {
  return ticker.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfMessageTicker(
  ticker: MessageTickerGraphic,
  testId: string,
): HTMLElement | undefined {
  return ticker.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** The message on air: the text of the message pill not hidden from assistive technology. */
export function readMessageOnAir(ticker: MessageTickerGraphic): string | null | undefined {
  const pills = ticker.shadowRoot?.querySelectorAll<HTMLElement>(
    '[data-testid="message-ticker-message"]',
  );
  return [...(pills ?? [])].find((pill) => pill.getAttribute('aria-hidden') !== 'true')
    ?.textContent;
}

/** The page cell's text: "1/3". */
export function readPageCell(ticker: MessageTickerGraphic): string | null | undefined {
  return findPartOfMessageTicker(ticker, 'message-ticker-page-cell')?.textContent;
}

/** Puts Ardósia's 7 s hold on :root until the test ends; motion tokens are left out. */
export function placeArdosiaStripHoldOnTheRoot(): void {
  document.documentElement.style.setProperty('--motion-strip-hold', '7000ms');
  onTestFinished(() => {
    document.documentElement.style.removeProperty('--motion-strip-hold');
  });
}

/** Fakes setTimeout so the test decides when the page hold ends; real timers come back after. */
export function takeControlOfTimers(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
