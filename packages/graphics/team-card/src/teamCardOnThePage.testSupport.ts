/**
 * Test support for the team card's component tests: the element under test, its data,
 * and readers for what it shows. No theme token is placed on the page here, so every
 * timeline lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished } from 'vitest';

import TeamCardGraphic from './team-card.js';
import type { TeamCardData } from './teamCardModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-team-card-under-test', TeamCardGraphic);

/**
 * Builds car 7 without media: Reptiles Baja PUC-Rio, PUC-Rio, Rio de Janeiro · RJ. jsdom
 * loads no image, so the lifecycle tests use a card without photo or logo, and the tests
 * about images fire the images' own events.
 */
export function createReptilesTeamCardDataWithoutMedia(): TeamCardData {
  return {
    carNumber: 7,
    teamName: 'Reptiles Baja PUC-Rio',
    schoolName: 'PUC-Rio',
    city: 'Rio de Janeiro',
    state: 'RJ',
  };
}

/** Builds car 7 with its photo and its logo on the light plate. */
export function createReptilesTeamCardDataWithMedia(): TeamCardData {
  return {
    ...createReptilesTeamCardDataWithoutMedia(),
    carPhotoUrl: '/media/0b6f3c2a-photo-car-7',
    logoUrl: '/media/5d1e9a40-logo-reptiles',
    logoOnLightPlate: true,
  };
}

/**
 * Puts a fresh team card element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createTeamCardOnThePage(): TeamCardGraphic {
  const teamCard = document.createElement('baja-team-card-under-test') as TeamCardGraphic;
  document.body.append(teamCard);
  onTestFinished(async () => {
    await teamCard.dispose();
    teamCard.remove();
  });
  return teamCard;
}

/** Loads the team card the way an OBS renderer does: real-time, at 1920x1080. */
export function loadTeamCardWithData(teamCard: TeamCardGraphic, data: unknown) {
  return teamCard.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfTeamCard(
  teamCard: TeamCardGraphic,
  testId: string,
): HTMLElement | undefined {
  return teamCard.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
export function readShownText(
  teamCard: TeamCardGraphic,
  testId: string,
): string | null | undefined {
  return findPartOfTeamCard(teamCard, testId)?.textContent;
}

/** Reads the card's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPanelOpacity(teamCard: TeamCardGraphic): string | undefined {
  return findPartOfTeamCard(teamCard, 'team-card-panel')?.style.opacity;
}
