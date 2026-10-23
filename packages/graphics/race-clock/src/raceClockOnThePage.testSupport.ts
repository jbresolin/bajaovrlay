/**
 * Test support shared by the race clock's component tests: the element under test, its
 * data, and control over frames and time. No theme token is placed on the page here, so
 * every timeline lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished, vi } from 'vitest';

import RaceClockGraphic from './race-clock.js';
import type { RaceClockData } from './raceClockModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-race-clock-under-test', RaceClockGraphic);

/** 16 May 2026, 14:30:00 UTC: when the clock reading in these tests was taken. */
export const readingWallClockMs = Date.parse('2026-05-16T14:30:00.000Z');

/** Builds the data the server sends when the enduro is under green flag, 1:05:00 in. */
export function createGreenFlagEnduroData(): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: readingWallClockMs,
    running: true,
    lapsCompletedByLeader: 12,
  };
}

/**
 * Puts a fresh race clock element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so no clock keeps ticking into the
 * next test.
 */
export function createRaceClockOnThePage(): RaceClockGraphic {
  const raceClock = document.createElement('baja-race-clock-under-test') as RaceClockGraphic;
  document.body.append(raceClock);
  onTestFinished(async () => {
    await raceClock.dispose();
    raceClock.remove();
  });
  return raceClock;
}

/** Loads the race clock the way an OBS renderer does: real-time, at 1920x1080. */
export function loadRaceClockWithData(raceClock: RaceClockGraphic, data: unknown) {
  return raceClock.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfRaceClock(
  raceClock: RaceClockGraphic,
  testId: string,
): HTMLElement | undefined {
  return raceClock.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
export function readShownText(
  raceClock: RaceClockGraphic,
  testId: string,
): string | null | undefined {
  return raceClock.shadowRoot?.querySelector(`[data-testid="${testId}"]`)?.textContent;
}

/** Reads the panel's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPanelOpacity(raceClock: RaceClockGraphic): string | undefined {
  const panel = raceClock.shadowRoot?.querySelector<HTMLElement>(
    '[data-testid="race-clock-panel"]',
  );
  return panel?.style.opacity;
}

/**
 * Replaces requestAnimationFrame with frames that run only when the test says so, and
 * fixes Date.now, so the test decides exactly when time passes and frames happen. The
 * real ones come back when the test ends, even if it failed or timed out.
 */
export function takeControlOfFramesAndTime() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(readingWallClockMs);
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
    runPendingFrames(): void {
      const callbacksDueNow = [...pendingCallbacks.values()];
      pendingCallbacks.clear();
      for (const callback of callbacksDueNow) {
        callback(performance.now());
      }
    },
    letWallClockTimePass(milliseconds: number): void {
      vi.setSystemTime(Date.now() + milliseconds);
    },
  };
}
