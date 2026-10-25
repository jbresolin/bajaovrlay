/**
 * Test support shared by the standings' tests: the element under test, a 61-team field,
 * the token declarations of Ardósia, and readers of what is on the board. No theme token is
 * placed on the page unless a test places it, so every timeline lasts 0 ms and a test never
 * waits on real motion unless it asks for it.
 */
import { onTestFinished } from 'vitest';

import { createOverallStandingsEntries } from './previewData.js';
import StandingsGraphic from './standings.js';
import type { StandingsEntry } from './standingsModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-standings-under-test', StandingsGraphic);

/**
 * Puts a fresh standings element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so no page timer runs into the next test.
 */
export function createStandingsOnThePage(): StandingsGraphic {
  const standings = document.createElement('baja-standings-under-test') as StandingsGraphic;
  document.body.append(standings);
  onTestFinished(async () => {
    await standings.dispose();
    standings.remove();
  });
  return standings;
}

/** Loads the standings the way an OBS renderer does: real-time, at 1920x1080. */
export function loadStandingsWithData(standings: StandingsGraphic, data: unknown) {
  return standings.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** One part of the board by its test id inside the shadow root; undefined when absent. */
export function findPartOfStandings(
  standings: StandingsGraphic,
  testId: string,
): HTMLElement | undefined {
  return standings.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** Every element with a test id inside the shadow root, in document order. */
export function listPartsOfStandings(standings: StandingsGraphic, testId: string): HTMLElement[] {
  const parts = standings.shadowRoot?.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`);
  return parts === undefined ? [] : [...parts];
}

/** The car numbers of the rows on the board, table by table, top to bottom. */
export function readCarNumbersOnTheBoard(standings: StandingsGraphic): number[] {
  return listPartsOfStandings(standings, 'standings-row').map((row) =>
    Number(row.dataset.carNumber),
  );
}

/** The text of the head's page line ("1/3 · 1º A 20º"). */
export function readPageLine(standings: StandingsGraphic): string | null | undefined {
  return findPartOfStandings(standings, 'standings-page-line')?.textContent;
}

/** The motion tokens of Ardósia, as packages/theme/ardosia/tokens.css declares them. */
export const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-row-stagger': '30ms',
  '--motion-lead': '100ms',
  '--motion-board-hold': '10000ms',
  '--motion-in-offset': '20',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
};

/** Puts tokens on :root for one test (the kit's, shared by every graphic's tests). */
export { placeTokensOnTheRoot } from '@bajaovrlay/graphics-kit/themeTokensOnThePage.testSupport';

/**
 * The 54 teams of the export plus seven late entrants with no score yet: 61 teams, one
 * more than the columns board holds on a page.
 */
export function createOverallEntriesWithSevenLateEntrants(): StandingsEntry[] {
  const lateEntrants: StandingsEntry[] = [
    {
      rank: 51,
      carNumber: 60,
      teamName: 'Baja Unifei Itabira',
      schoolName: 'UNIFEI-Ita',
      points: 0,
    },
    { rank: 51, carNumber: 61, teamName: 'Jaguar Baja', schoolName: 'UFMS', points: 0 },
    { rank: 51, carNumber: 62, teamName: 'Capivara Off-Road', schoolName: 'UFV', points: 0 },
    { rank: 51, carNumber: 63, teamName: 'Baja Sertão', schoolName: 'UFC', points: 0 },
    { rank: 51, carNumber: 64, teamName: 'Lobo Guará Baja', schoolName: 'UFG', points: 0 },
    { rank: 51, carNumber: 65, teamName: 'Tucano Racing', schoolName: 'UFPA', points: 0 },
    { rank: 51, carNumber: 66, teamName: 'Baja Pampa', schoolName: 'UNIPAMPA', points: 0 },
  ];
  const overallEntries = createOverallStandingsEntries();
  const rankedEntries = overallEntries.filter((entry) => entry.isDisqualified !== true);
  const disqualifiedEntries = overallEntries.filter((entry) => entry.isDisqualified === true);
  return [...rankedEntries, ...lateEntrants, ...disqualifiedEntries];
}
