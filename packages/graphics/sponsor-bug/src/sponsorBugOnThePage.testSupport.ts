/**
 * Test support for the sponsor bug's component tests: the element under test, its data,
 * and readers for what it shows. No theme token is placed on the page here, so every
 * timeline lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished } from 'vitest';

import SponsorBugGraphic from './sponsor-bug.js';
import type { SponsorBugData } from './sponsorBugModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-sponsor-bug-under-test', SponsorBugGraphic);

/**
 * Builds the enduro's bug without a sponsor: the mark and "ENDURO". jsdom loads no image,
 * so the lifecycle tests mostly use this one, and the tests about images fire the images'
 * own events.
 */
export function createEnduroBugDataWithoutSponsor(): SponsorBugData {
  return { eventWord: 'ENDURO', caption: 'Apresentado por' };
}

/** Builds the enduro's bug presented by the Diamante sponsor, its logo on the light plate. */
export function createEnduroBugDataWithSponsor(): SponsorBugData {
  return {
    ...createEnduroBugDataWithoutSponsor(),
    sponsorLogoUrl: '/media/7d1e3a5c-logo-serra-azul',
    sponsorLogoOnLightPlate: true,
  };
}

/**
 * Puts a fresh sponsor bug element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createSponsorBugOnThePage(): SponsorBugGraphic {
  const sponsorBug = document.createElement('baja-sponsor-bug-under-test') as SponsorBugGraphic;
  document.body.append(sponsorBug);
  onTestFinished(async () => {
    await sponsorBug.dispose();
    sponsorBug.remove();
  });
  return sponsorBug;
}

/** Loads the sponsor bug the way an OBS renderer does: real-time, at 1920x1080. */
export function loadSponsorBugWithData(sponsorBug: SponsorBugGraphic, data: unknown) {
  return sponsorBug.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfSponsorBug(
  sponsorBug: SponsorBugGraphic,
  testId: string,
): HTMLElement | undefined {
  return (
    sponsorBug.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined
  );
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
export function readShownText(
  sponsorBug: SponsorBugGraphic,
  testId: string,
): string | null | undefined {
  return findPartOfSponsorBug(sponsorBug, testId)?.textContent;
}

/** Reads the card's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPanelOpacity(sponsorBug: SponsorBugGraphic): string | undefined {
  return findPartOfSponsorBug(sponsorBug, 'sponsor-bug-panel')?.style.opacity;
}
