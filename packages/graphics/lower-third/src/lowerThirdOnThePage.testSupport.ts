/**
 * Test support for the lower third's component tests: the element under test, its data,
 * and readers for what it shows. No theme token is placed on the page here, so every
 * timeline lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished } from 'vitest';

import LowerThirdGraphic from './lower-third.js';
import type { LowerThirdData } from './lowerThirdModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-lower-third-under-test', LowerThirdGraphic);

/** Builds a team captain's lower third: Mariana Costa, captain of Baja UFMG. */
export function createTeamCaptainData(): LowerThirdData {
  return { name: 'Mariana Costa', role: 'Capitã da equipe', teamLine: 'Baja UFMG · UFMG' };
}

/** Builds a narrator's lower third as Cadastros gives it: a name and a role, no team. */
export function createNarratorData(): LowerThirdData {
  return { name: 'Ana Paula Ribeiro', role: 'Narradora' };
}

/**
 * Puts a fresh lower third element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createLowerThirdOnThePage(): LowerThirdGraphic {
  const lowerThird = document.createElement('baja-lower-third-under-test') as LowerThirdGraphic;
  document.body.append(lowerThird);
  onTestFinished(async () => {
    await lowerThird.dispose();
    lowerThird.remove();
  });
  return lowerThird;
}

/** Loads the lower third the way an OBS renderer does: real-time, at 1920x1080. */
export function loadLowerThirdWithData(lowerThird: LowerThirdGraphic, data: unknown) {
  return lowerThird.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfLowerThird(
  lowerThird: LowerThirdGraphic,
  testId: string,
): HTMLElement | undefined {
  return (
    lowerThird.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined
  );
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
export function readShownText(
  lowerThird: LowerThirdGraphic,
  testId: string,
): string | null | undefined {
  return findPartOfLowerThird(lowerThird, testId)?.textContent;
}

/** Reads both pills' inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPillOpacities(lowerThird: LowerThirdGraphic): Array<string | undefined> {
  return [
    findPartOfLowerThird(lowerThird, 'lower-third-name-pill')?.style.opacity,
    findPartOfLowerThird(lowerThird, 'lower-third-role-pill')?.style.opacity,
  ];
}
