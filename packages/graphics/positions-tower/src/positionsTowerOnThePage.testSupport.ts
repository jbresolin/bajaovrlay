/**
 * Test support shared by the tower's component and view tests: the element under test,
 * the enduro sample as entries, and readers of the rows on the page. No theme token is
 * placed on the page here, so every timeline lasts 0 ms and a test never waits on real
 * motion unless it places tokens itself.
 */
import positionsSample from '@bajaovrlay/shared/samples/positions.json';
import { onTestFinished } from 'vitest';

import PositionsTowerGraphic from './positions-tower.js';
import {
  parseCompletePositionsTowerData,
  type PositionsTowerData,
  type TowerEntry,
} from './positionsTowerModel.js';
import { swapCarsAtPositions } from './previewData.js';

// Two cars trading places, as the preview buttons do it; the tests send the same lists.
export { swapCarsAtPositions };

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-positions-tower-under-test', PositionsTowerGraphic);

/**
 * The 60 cars of the enduro sample at lap 34 (packages/shared's positions sample), as
 * the tower reads them: car 31 "Acauã Baja" leads, car 69 is in the pit at 17th, car 65
 * is broken down at 49th and car 96 has retired at 60th.
 */
export function createEnduroSampleEntries(): TowerEntry[] {
  const check = parseCompletePositionsTowerData({ entries: positionsSample.entries });
  if (!check.isValid) {
    throw new Error(`the positions sample must pass the tower's model: ${check.problem}`);
  }
  return check.data.entries;
}

/** The first `count` cars of the sample, as a smaller field. */
export function createFirstCarsOfTheEnduroSample(count: number): TowerEntry[] {
  return createEnduroSampleEntries().slice(0, count);
}

/** The compact tower on the whole sample, pages cycling: what an item starts with. */
export function createCompactTowerDataOnTheSample(): PositionsTowerData {
  return { entries: createEnduroSampleEntries(), layout: 'compact', paging: 'cycle' };
}

/**
 * The same tower with its pages held on page 1. Without the theme the page hold reads
 * 0 ms, so a cycling tower on air would turn its pages under a test that is about
 * something else; holding the pages keeps those tests about what they say.
 */
export function createHeldCompactTowerDataOnTheSample(): PositionsTowerData {
  return { ...createCompactTowerDataOnTheSample(), paging: 'firstPageOnly' };
}

/**
 * Puts a fresh tower element on the page, as a renderer does before calling load. When
 * the test ends it is disposed and removed, so no page timer keeps turning into the
 * next test.
 */
export function createTowerOnThePage(): PositionsTowerGraphic {
  const tower = document.createElement('baja-positions-tower-under-test') as PositionsTowerGraphic;
  document.body.append(tower);
  onTestFinished(async () => {
    await tower.dispose();
    tower.remove();
  });
  return tower;
}

/** Loads the tower the way an OBS renderer does: real-time, at 1920x1080. */
export function loadTowerWithData(tower: PositionsTowerGraphic, data: unknown) {
  return tower.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** The row `<li>` elements on the page, in slot order (rows lifting out included). */
export function listRowElements(tower: PositionsTowerGraphic): HTMLElement[] {
  const rows = tower.shadowRoot?.querySelectorAll<HTMLElement>(
    '[data-testid="positions-tower-row"]',
  );
  return rows === undefined ? [] : [...rows];
}

/** The rows in flow (not lifting out), in slot order. */
export function listRowElementsInFlow(tower: PositionsTowerGraphic): HTMLElement[] {
  return listRowElements(tower).filter((row) => !row.classList.contains('is-leaving'));
}

/** The car numbers of the rows in flow, top to bottom. */
export function readCarNumbersOnThePage(tower: PositionsTowerGraphic): number[] {
  return listRowElementsInFlow(tower).map((row) => Number(row.dataset.carNumber));
}

/** The text of one cell of a row, found by the cell's test id. */
export function readRowCellText(row: HTMLElement, cellTestId: string): string | null | undefined {
  return row.querySelector(`[data-testid="${cellTestId}"]`)?.textContent;
}

/** One part of the tower by its test id inside the shadow root; undefined when absent. */
export function findPartOfTower(
  tower: PositionsTowerGraphic,
  testId: string,
): HTMLElement | undefined {
  return tower.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** The motion tokens of Ardósia, as packages/theme/ardosia/tokens.css declares them. */
export const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-row-stagger': '30ms',
  '--motion-swap': '400ms',
  '--motion-strip-hold': '7000ms',
  '--motion-cue-hold': '2000ms',
  '--motion-in-offset': '20',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
  '--ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  '--tower-rows-per-page': '20',
};

/**
 * Puts tokens on :root, as the renderer page does, and takes them off again when the
 * test ends so a test without a theme reads nothing.
 */
export function placeTokensOnTheRoot(tokenDeclarations: Record<string, string>): void {
  const root = document.documentElement;
  for (const [tokenName, value] of Object.entries(tokenDeclarations)) {
    root.style.setProperty(tokenName, value);
  }
  onTestFinished(() => {
    for (const tokenName of Object.keys(tokenDeclarations)) {
      root.style.removeProperty(tokenName);
    }
  });
}
