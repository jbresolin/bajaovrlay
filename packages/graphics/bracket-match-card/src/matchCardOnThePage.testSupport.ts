/**
 * Test support for the "a seguir" card's component tests: the element under test, its
 * data and readers for what it shows. No theme token is placed on the page here, so every
 * timeline lasts 0 ms and a test never waits on real motion. jsdom loads no image, so the
 * data here has no logo: each side shows its car-number chip.
 */
import { onTestFinished } from 'vitest';

import BracketMatchCardGraphic from './bracket-match-card.js';
import type { MatchCardData } from './matchCardModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-bracket-match-card-under-test', BracketMatchCardGraphic);

/** The first semifinal "a seguir", no logos: Corisco Baja (32) against Kaizen Piratas do Cerrado (12). */
export function createSemifinal1Data(): MatchCardData {
  return {
    roundName: 'Semifinal',
    bestOf: 3,
    carANumber: 32,
    carATeamName: 'Corisco Baja',
    carASchoolName: 'UPE',
    carBNumber: 12,
    carBTeamName: 'Kaizen Piratas do Cerrado',
    carBSchoolName: 'UnB',
  };
}

/** The second semifinal, as "a seguir" moves on: Equipe Cactus Baja (13) against Equipe UFSC Baja (29). */
export function createSemifinal2Data(): MatchCardData {
  return {
    roundName: 'Semifinal',
    bestOf: 3,
    carANumber: 13,
    carATeamName: 'Equipe Cactus Baja',
    carASchoolName: 'UFERSA-Mos',
    carBNumber: 29,
    carBTeamName: 'Equipe UFSC Baja',
    carBSchoolName: 'UFSC-Fln',
  };
}

/**
 * Puts a fresh card element on the page, as a renderer does before calling load. When the
 * test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createMatchCardOnThePage(): BracketMatchCardGraphic {
  const matchCard = document.createElement(
    'baja-bracket-match-card-under-test',
  ) as BracketMatchCardGraphic;
  document.body.append(matchCard);
  onTestFinished(async () => {
    await matchCard.dispose();
    matchCard.remove();
  });
  return matchCard;
}

/** Loads the card the way an OBS renderer does: real-time, at 1920x1080. */
export function loadMatchCardWithData(matchCard: BracketMatchCardGraphic, data: unknown) {
  return matchCard.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the card by its test id inside the shadow root; undefined when absent. */
export function findPartOfMatchCard(
  matchCard: BracketMatchCardGraphic,
  testId: string,
): HTMLElement | undefined {
  return matchCard.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** The two team names the card shows, car A first; empty when it shows no match. */
export function readTeamNamesShown(matchCard: BracketMatchCardGraphic): string[] {
  const sides = ['a', 'b'];
  return sides
    .map((side) => findPartOfMatchCard(matchCard, `match-card-team-${side}`)?.textContent?.trim())
    .filter((name): name is string => name !== undefined);
}
