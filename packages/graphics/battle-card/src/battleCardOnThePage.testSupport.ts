/**
 * Test support for the battle card's component tests: the element under test, its data,
 * the motion tokens when a test needs real timings, and readers for what it shows. With
 * no token on the page every timeline lasts 0 ms, so most tests never wait on motion.
 */
import { onTestFinished } from 'vitest';

import BattleCardGraphic from './battle-card.js';
import type { BattleCardData } from './battleCardModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-battle-card-under-test', BattleCardGraphic);

/** Builds the 30ª Competição's battle at lap 1: Imperador (8) 4th, Equipe FEI Baja (1) 5th, +2,0. */
export function createImperadorAheadOfFeiData(): BattleCardData {
  return {
    aheadPosition: 4,
    aheadCarNumber: 8,
    aheadTeamName: 'Imperador',
    aheadSchoolName: 'UTFPR-CWB',
    aheadLaps: 1,
    behindPosition: 5,
    behindCarNumber: 1,
    behindTeamName: 'Equipe FEI Baja',
    behindSchoolName: 'FEI',
    behindLaps: 1,
    gapMs: 2000,
  };
}

/**
 * Puts a fresh battle card element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createBattleCardOnThePage(): BattleCardGraphic {
  const battleCard = document.createElement('baja-battle-card-under-test') as BattleCardGraphic;
  document.body.append(battleCard);
  onTestFinished(async () => {
    await battleCard.dispose();
    battleCard.remove();
  });
  return battleCard;
}

/** Loads the battle card the way an OBS renderer does: real-time, at 1920x1080. */
export function loadBattleCardWithData(battleCard: BattleCardGraphic, data: unknown) {
  return battleCard.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfBattleCard(
  battleCard: BattleCardGraphic,
  testId: string,
): HTMLElement | undefined {
  return (
    battleCard.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined
  );
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
export function readShownText(
  battleCard: BattleCardGraphic,
  testId: string,
): string | null | undefined {
  return findPartOfBattleCard(battleCard, testId)?.textContent;
}

/** Reads one part's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPartOpacity(battleCard: BattleCardGraphic, testId: string): string | undefined {
  return findPartOfBattleCard(battleCard, testId)?.style.opacity;
}

/**
 * Puts Ardósia's motion tokens on the two parts the timelines read them from (the car
 * ahead's pill for in and out, the trend layer for the crossfade), so the timelines take
 * their real lengths. On the parts themselves, because jsdom does not pass custom
 * properties down into a shadow root as a browser does. Call it after load.
 */
export function placeArdosiaMotionTokensOnTheParts(battleCard: BattleCardGraphic): void {
  const tokenDeclarations: Record<string, string> = {
    '--motion-in': '400ms',
    '--motion-out': '250ms',
    '--motion-lead': '100ms',
    '--motion-flag': '300ms',
    '--motion-in-offset': '20',
    '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
    '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
  };
  const partsReadFrom = ['battle-card-ahead', 'battle-card-trend'];
  for (const testId of partsReadFrom) {
    const part = findPartOfBattleCard(battleCard, testId);
    for (const [tokenName, value] of Object.entries(tokenDeclarations)) {
      part?.style.setProperty(tokenName, value);
    }
  }
}
