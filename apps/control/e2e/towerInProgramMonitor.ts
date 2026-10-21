// Test support: finding the positions tower and the race clock card inside the "Programa"
// monitor frame of the control page (the program stand-in, /render/?monitor=1), reading
// the order of the tower's rows, and measuring how the clock card and the tower stack.
// The parts are found inside the custom elements' shadow roots, which Playwright's
// locators reach through. Used by towerFollowsTheSimulator.e2e.ts. Functions only;
// nothing here remembers anything between calls or between tests.
import type { Locator, Page } from '@playwright/test';

/** The id of the tower's layer ("Torre"), as the server seeds it. */
export const towerLayerId = 'tower';

/** Finds the tower element on the "Torre" layer inside the "Programa" monitor frame. */
export function findTowerInProgramMonitor(page: Page): Locator {
  return page
    .frameLocator('iframe[title="Programa"]')
    .locator(`[data-layer-id="${towerLayerId}"] > baja-graphic-positions-tower`);
}

/** Finds the tower's own box (the head and the rows), inside the element's shadow root. */
export function findTowerSection(page: Page): Locator {
  return findTowerInProgramMonitor(page).getByTestId('positions-tower');
}

/** Finds the head pill of the tower, which carries one caption per column shown. */
export function findTowerHead(page: Page): Locator {
  return findTowerInProgramMonitor(page).getByTestId('positions-tower-head');
}

/**
 * Finds the rows of the tower, one per car on the page. A row lifting out of the page
 * after a change stays in the DOM for its 250 ms animation, marked `is-leaving`; it is
 * no longer a place, so it is left out.
 */
export function findTowerRows(page: Page): Locator {
  return findTowerInProgramMonitor(page).locator(
    '[data-testid="positions-tower-row"]:not(.is-leaving)',
  );
}

/** Finds the race clock's card on the "Relógio" layer inside the "Programa" monitor frame. */
export function findClockCardInProgramMonitor(page: Page): Locator {
  return page
    .frameLocator('iframe[title="Programa"]')
    .locator('[data-layer-id="clock"] > baja-graphic-race-clock')
    .getByTestId('race-clock-panel');
}

/** Reads the car numbers of the tower's rows, in the order they are on the page. */
export async function readCarOrderOfTheTowerRows(page: Page): Promise<number[]> {
  const carNumbersAsText = await findTowerRows(page).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-car-number') ?? ''),
  );
  return carNumbersAsText.map(Number);
}

/**
 * Measures the clock card and the tower in the monitor and says how they stack: the card
 * above the tower (its bottom no lower than the tower's top) and both in the same column
 * (the same left edge and width, within a pixel). The boxes are measured the same way,
 * so they compare with each other whatever the monitor's scale; they come along for the
 * failure message.
 */
export async function measureHowTheClockAndTheTowerStack(page: Page) {
  const clockBox = await findClockCardInProgramMonitor(page).boundingBox();
  const towerBox = await findTowerSection(page).boundingBox();
  if (clockBox === null || towerBox === null) {
    return { isTheClockAboveTheTower: false, isInTheSameColumn: false, clockBox, towerBox };
  }
  const clockBottom = clockBox.y + clockBox.height;
  const isTheClockAboveTheTower = clockBottom <= towerBox.y;
  const isInTheSameColumn =
    Math.abs(clockBox.x - towerBox.x) <= 1 && Math.abs(clockBox.width - towerBox.width) <= 1;
  return { isTheClockAboveTheTower, isInTheSameColumn, clockBox, towerBox };
}
