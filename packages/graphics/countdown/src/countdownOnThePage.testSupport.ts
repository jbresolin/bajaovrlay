/**
 * Test support for the countdown's component tests: the element under test, its data,
 * readers for what it shows, and control over frames and time. No theme token is placed on
 * the page here, so every timeline lasts 0 ms and a test never waits on real motion.
 */
import { putGsapsFrameLoopToSleep } from '@bajaovrlay/graphics-kit/runningMotions.testSupport';
import { onTestFinished, vi } from 'vitest';

import CountdownGraphic from './countdown.js';
import type { CountdownData, CountdownLayout } from './countdownModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-countdown-under-test', CountdownGraphic);

/** The enduro's start: Sunday 30 March 2025, 10:00 in Brasília (UTC−3). */
export const enduroStartsAtMs = Date.parse('2025-03-30T10:00:00.000-03:00');

/** 09:36:15, the design's 23:45 before the start: the moment most tests begin at. */
export const designsMomentBeforeTheStartMs = enduroStartsAtMs - (23 * 60 + 45) * 1000;

/** Builds the enduro's countdown in a layout, as an item from the schedule gives it. */
export function createEnduroCountdownData(layout: CountdownLayout = 'card'): CountdownData {
  return {
    layout,
    sessionName: 'Enduro de Resistência',
    startsAtMs: enduroStartsAtMs,
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
  };
}

/**
 * Puts a fresh countdown on the page, as a renderer does before calling load. When the
 * test ends it is disposed and removed, so no count keeps ticking into the next test.
 */
export function createCountdownOnThePage(): CountdownGraphic {
  const countdown = document.createElement('baja-countdown-under-test') as CountdownGraphic;
  document.body.append(countdown);
  onTestFinished(async () => {
    await countdown.dispose();
    countdown.remove();
  });
  return countdown;
}

/** Loads the countdown the way an OBS renderer does: real-time, at 1920x1080. */
export function loadCountdownWithData(countdown: CountdownGraphic, data: unknown) {
  return countdown.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfCountdown(
  countdown: CountdownGraphic,
  testId: string,
): HTMLElement | undefined {
  return countdown.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
export function readShownText(countdown: CountdownGraphic, testId: string): string | undefined {
  return findPartOfCountdown(countdown, testId)?.textContent ?? undefined;
}

/** Reads the count on screen. */
export function readCount(countdown: CountdownGraphic): string | undefined {
  return readShownText(countdown, 'countdown-count');
}

/**
 * Replaces requestAnimationFrame with frames that run only when the test says so, and
 * fixes Date.now at `startingMomentMs`, so the test decides when time passes and frames
 * happen. The real ones come back when the test ends, even if it failed.
 */
export function takeControlOfFramesAndTime(startingMomentMs = designsMomentBeforeTheStartMs) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(startingMomentMs);
  const pendingCallbacks = new Map<number, FrameRequestCallback>();
  let lastFrameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    lastFrameId += 1;
    pendingCallbacks.set(lastFrameId, callback);
    return lastFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (frameId: number) => pendingCallbacks.delete(frameId));
  onTestFinished(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  return {
    /** Runs every frame booked so far, as the browser's next frame would. */
    runPendingFrames(): void {
      const callbacksDueNow = [...pendingCallbacks.values()];
      pendingCallbacks.clear();
      for (const callback of callbacksDueNow) {
        callback(performance.now());
      }
    },
    /** How many of the countdown's frames are booked (GSAP's loop put to sleep first). */
    countPendingFrames(): number {
      putGsapsFrameLoopToSleep();
      return pendingCallbacks.size;
    },
    letTimePass(milliseconds: number): void {
      vi.setSystemTime(Date.now() + milliseconds);
    },
  };
}
