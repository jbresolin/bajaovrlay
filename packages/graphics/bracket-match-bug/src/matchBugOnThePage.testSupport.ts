/**
 * Test support for the match bug's component tests: the element under test, its data and
 * readers for what it shows. No theme token is placed on the page here, so every timeline
 * lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished } from 'vitest';

import BracketMatchBugGraphic from './bracket-match-bug.js';
import type { MatchBugData } from './matchBugModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-bracket-match-bug-under-test', BracketMatchBugGraphic);

/** The first quarter-final before it starts: Corisco (32) against Buffalo (34). */
export function createQuarterFinal1Data(): MatchBugData {
  return {
    roundName: 'Quartas de final',
    carANumber: 32,
    carAShortName: 'Corisco',
    carBNumber: 34,
    carBShortName: 'Buffalo',
  };
}

/** The second quarter-final, as "agora" moves on: Pequi (12) against Acauã (47). */
export function createQuarterFinal2Data(): MatchBugData {
  return {
    roundName: 'Quartas de final',
    carANumber: 12,
    carAShortName: 'Pequi',
    carBNumber: 47,
    carBShortName: 'Acauã',
  };
}

/**
 * Puts a fresh match bug element on the page, as a renderer does before calling load.
 * When the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createMatchBugOnThePage(): BracketMatchBugGraphic {
  const matchBug = document.createElement(
    'baja-bracket-match-bug-under-test',
  ) as BracketMatchBugGraphic;
  document.body.append(matchBug);
  onTestFinished(async () => {
    await matchBug.dispose();
    matchBug.remove();
  });
  return matchBug;
}

/** Loads the match bug the way an OBS renderer does: real-time, at 1920x1080. */
export function loadMatchBugWithData(matchBug: BracketMatchBugGraphic, data: unknown) {
  return matchBug.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the bug by its test id inside the shadow root; undefined when absent. */
export function findPartOfMatchBug(
  matchBug: BracketMatchBugGraphic,
  testId: string,
): HTMLElement | undefined {
  return matchBug.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** The two short names the bug shows, car A first; empty when it shows no match. */
export function readShortNamesShown(matchBug: BracketMatchBugGraphic): string[] {
  const names = matchBug.shadowRoot?.querySelectorAll('[data-testid="match-bug-car-name"]') ?? [];
  return [...names].map((name) => name.textContent?.trim() ?? '');
}
