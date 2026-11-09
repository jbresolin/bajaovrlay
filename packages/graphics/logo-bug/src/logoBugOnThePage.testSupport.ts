/**
 * Test support for the logo bug's component tests: the element under test, its data, and
 * readers for what it shows. No theme token is placed on the page here, so every timeline
 * lasts 0 ms and a test never waits on real motion. jsdom loads no image: a test settles
 * the logo itself with `letTheLogoLoad` or `letTheLogoFail`.
 */
import { onTestFinished } from 'vitest';

import LogoBugGraphic from './logo-bug.js';
import type { LogoBugData } from './logoBugModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-logo-bug-under-test', LogoBugGraphic);

/** Builds the channel's logo as the seeded item gives it once the file is picked. */
export function createChannelLogoData(): LogoBugData {
  return { logoUrl: '/media/3b8f0c2e-logo-baja-sae-brasil' };
}

/** An address whose file was deleted from the media store: the browser reports it broken. */
export const deletedLogoAddress = '/media/9c4d2a10-logo-apagado';

/**
 * Puts a fresh logo bug element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createLogoBugOnThePage(): LogoBugGraphic {
  const logoBug = document.createElement('baja-logo-bug-under-test') as LogoBugGraphic;
  document.body.append(logoBug);
  onTestFinished(async () => {
    await logoBug.dispose();
    logoBug.remove();
  });
  return logoBug;
}

/** Loads the logo bug the way an OBS renderer does: real-time, at 1920x1080. */
export function loadLogoBugWithData(logoBug: LogoBugGraphic, data: unknown) {
  return logoBug.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Lets the pending promise callbacks and timers of the page run once. */
export function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfLogoBug(
  logoBug: LogoBugGraphic,
  testId: string,
): HTMLElement | undefined {
  return logoBug.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** The logo on screen (its file arrived); undefined when the corner is empty. */
export function findTheShownLogo(logoBug: LogoBugGraphic): HTMLImageElement | undefined {
  return (
    logoBug.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="logo-bug-image"][data-image-state="loaded"]',
    ) ?? undefined
  );
}

/** The logo whose file is on its way, hidden until it arrives; undefined when none is. */
export function findTheLogoOnItsWay(logoBug: LogoBugGraphic): HTMLImageElement | undefined {
  return (
    logoBug.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="logo-bug-image"][data-image-state="waiting"]',
    ) ?? undefined
  );
}

/** How many image elements the graphic holds: the shown logo and the one on its way. */
export function countLogoImages(logoBug: LogoBugGraphic): number {
  return logoBug.shadowRoot?.querySelectorAll('[data-testid="logo-bug-image"]').length ?? 0;
}

/** Fires the load event of the logo on its way, as a browser does once the file has arrived. */
export function letTheLogoLoad(logoBug: LogoBugGraphic): void {
  findTheLogoOnItsWay(logoBug)?.dispatchEvent(new Event('load'));
}

/** Fires the error event of the logo on its way, as a browser does for a missing or broken file. */
export function letTheLogoFail(logoBug: LogoBugGraphic): void {
  findTheLogoOnItsWay(logoBug)?.dispatchEvent(new Event('error'));
}

/** Loads a logo bug and lets its logo load, so the test can go on to play it. */
export async function loadLogoBugAndItsLogo(logoBug: LogoBugGraphic, data: unknown) {
  const pendingLoad = loadLogoBugWithData(logoBug, data);
  await letThePageCatchUp();
  letTheLogoLoad(logoBug);
  return pendingLoad;
}

/** Loads a logo bug whose image fails, so the test starts from a logo with nothing to show. */
export async function loadLogoBugWithAFailedLogo(logoBug: LogoBugGraphic) {
  const pendingLoad = loadLogoBugWithData(logoBug, { logoUrl: deletedLogoAddress });
  await letThePageCatchUp();
  letTheLogoFail(logoBug);
  return pendingLoad;
}

/** Reads the panel's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPanelOpacity(logoBug: LogoBugGraphic): string | undefined {
  return findPartOfLogoBug(logoBug, 'logo-bug-panel')?.style.opacity;
}
