/**
 * Test support shared by the podium's tests: the element under test, loading it like a
 * renderer, the token declarations of Ardósia, and readers of what is on the board. No
 * theme token is placed on the page unless a test places it, so every timeline lasts 0 ms
 * and a test never waits on real motion unless it asks for it.
 */
import { onTestFinished } from 'vitest';

import PodiumGraphic from './podium.js';
import type { PodiumSlot } from './podiumModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-podium-under-test', PodiumGraphic);

/**
 * Puts a fresh podium element on the page, as a renderer does before calling load. When
 * the test ends it is disposed and removed, so nothing runs into the next test.
 */
export function createPodiumOnThePage(): PodiumGraphic {
  const podium = document.createElement('baja-podium-under-test') as PodiumGraphic;
  document.body.append(podium);
  onTestFinished(async () => {
    await podium.dispose();
    podium.remove();
  });
  return podium;
}

/** Loads the podium the way an OBS renderer does: real-time, at 1920x1080. */
export function loadPodiumWithData(podium: PodiumGraphic, data: unknown) {
  return podium.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** One part of the board by its test id inside the shadow root; undefined when absent. */
export function findPartOfPodium(podium: PodiumGraphic, testId: string): HTMLElement | undefined {
  return podium.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** The card of one slot ('second', 'first' or 'third'); undefined before the first render. */
export function findCardOfSlot(podium: PodiumGraphic, slot: PodiumSlot): HTMLElement | undefined {
  return (
    podium.shadowRoot?.querySelector<HTMLElement>(
      `[data-testid="podium-card"][data-slot="${slot}"]`,
    ) ?? undefined
  );
}

/**
 * The slots whose cards are shown now, left to right: GSAP's autoAlpha leaves a shown card
 * at opacity 1 and visibility inherit, a hidden one at opacity 0 and visibility hidden.
 */
export function listShownSlots(podium: PodiumGraphic): PodiumSlot[] {
  const slotsLeftToRight: PodiumSlot[] = ['second', 'first', 'third'];
  return slotsLeftToRight.filter((slot) => {
    const card = findCardOfSlot(podium, slot);
    return card?.style.opacity === '1' && card.style.visibility !== 'hidden';
  });
}

/** The text of the head's line at the right ("2/3"). */
export function readStepLine(podium: PodiumGraphic): string | null | undefined {
  return findPartOfPodium(podium, 'podium-page-line')?.textContent;
}

/** The motion tokens of Ardósia the podium reads, as packages/theme/ardosia/tokens.css declares them. */
export const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-in-offset': '20',
  '--motion-podium-offset': '40',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
};

/** Puts tokens on :root for one test (the kit's, shared by every graphic's tests). */
export { placeTokensOnTheRoot } from '@bajaovrlay/graphics-kit/themeTokensOnThePage.testSupport';
