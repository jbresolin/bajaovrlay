/**
 * Test support for the lower strip's component tests: the element under test, its data,
 * readers for what it shows, and the theme's tokens placed on the page when a test needs
 * them. Unless a test places tokens, every timeline lasts 0 ms and the hold is the kit's
 * 7 s fallback.
 */
import { onTestFinished, vi } from 'vitest';

import LowerStripGraphic from './lower-strip.js';
import type { LowerStripData } from './lowerStripModel.js';
import { createRealEnduroField } from './realEnduroField.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-lower-strip-under-test', LowerStripGraphic);

// 14:00:00 on the enduro's day, as the server's clock read it.
export const twoInTheAfternoonMs = Date.UTC(2026, 2, 8, 17, 0, 0);

/** The real enduro's 34 cars an hour in, green flag, the clock held at 1:00:00. */
export function createRealEnduroStripData(): LowerStripData {
  return {
    entries: createRealEnduroField(),
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: twoInTheAfternoonMs,
    running: false,
  };
}

/**
 * Puts a fresh lower strip element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createLowerStripOnThePage(): LowerStripGraphic {
  const lowerStrip = document.createElement('baja-lower-strip-under-test') as LowerStripGraphic;
  document.body.append(lowerStrip);
  onTestFinished(async () => {
    await lowerStrip.dispose();
    lowerStrip.remove();
  });
  return lowerStrip;
}

/** Loads the lower strip the way an OBS renderer does: real-time, at 1920x1080. */
export function loadLowerStripWithData(lowerStrip: LowerStripGraphic, data: unknown) {
  return lowerStrip.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfLowerStrip(
  lowerStrip: LowerStripGraphic,
  testId: string,
): HTMLElement | undefined {
  return (
    lowerStrip.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined
  );
}

/** The lane named the running order: the one whose pills are on air. */
function findLaneOnAir(lowerStrip: LowerStripGraphic): HTMLElement | undefined {
  const lanes = lowerStrip.shadowRoot?.querySelectorAll<HTMLElement>(
    '[data-testid="lower-strip-lane"]',
  );
  return [...(lanes ?? [])].find((lane) => lane.getAttribute('aria-hidden') !== 'true');
}

/** The car numbers of the page on air, left to right. */
export function readCarNumbersOnAir(lowerStrip: LowerStripGraphic): number[] {
  const chips = findLaneOnAir(lowerStrip)?.querySelectorAll(
    '[data-testid="lower-strip-car-number"]',
  );
  return [...(chips ?? [])].map((chip) => Number(chip.textContent));
}

/** The pills of the page on air, left to right, as a viewer reads each: "1º 51 FAHOR". */
export function readCarPillsOnAir(lowerStrip: LowerStripGraphic): string[] {
  const pills = findLaneOnAir(lowerStrip)?.querySelectorAll('[data-testid="lower-strip-car"]');
  return [...(pills ?? [])].map((pill) =>
    [...pill.children].map((cell) => cell.textContent).join(' '),
  );
}

/** The page cell's text: "1/6". */
export function readPageCell(lowerStrip: LowerStripGraphic): string | null | undefined {
  return findPartOfLowerStrip(lowerStrip, 'lower-strip-page-cell')?.textContent;
}

/**
 * Puts theme tokens on :root, as the renderer page does, and takes them off again when the
 * test ends so a test without a theme reads nothing.
 */
export function placeTokensOnTheRoot(tokenDeclarations: Record<string, string>): void {
  const root = document.documentElement;
  for (const [tokenName, value] of Object.entries(tokenDeclarations)) {
    root.style.setProperty(tokenName, value);
  }
  onTestFinished(() => {
    for (const tokenName of Object.keys(tokenDeclarations)) {
      root.style.removeProperty(tokenName);
    }
  });
}

/** Fakes setTimeout so the test decides when the page hold ends; real timers come back after. */
export function takeControlOfTimers(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
