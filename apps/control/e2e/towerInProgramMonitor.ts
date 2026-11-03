// Test support: finding the positions tower and the race clock card inside the "Programa"
// monitor frame of the control page (the program stand-in, /render/?monitor=1), reading
// the order of the tower's rows, waiting inside the monitor until that order changes or
// reaches a given one, and measuring how the clock card and the tower stack.
// The parts are found inside the custom elements' shadow roots, which Playwright's
// locators reach through. Used by towerFollowsTheSimulator.e2e.ts. Functions only;
// nothing here remembers anything between calls or between tests.
import type { Frame, Locator, Page } from '@playwright/test';

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

/** The "Programa" monitor's own frame, for waits that run inside the page. */
async function findProgramMonitorFrame(page: Page): Promise<Frame> {
  const monitorElement = await page.locator('iframe[title="Programa"]').elementHandle();
  const monitorFrame = await monitorElement?.contentFrame();
  if (monitorFrame === undefined || monitorFrame === null) {
    throw new Error('the "Programa" monitor frame must be on the page');
  }
  return monitorFrame;
}

/** What a wait inside the monitor waits for: the rows to leave an order, or to show one. */
type TowerRowsWaitedFor = { carOrder: string[]; isWaitingToShowIt: boolean };

/**
 * Runs inside the monitor frame, at every frame: reads the car numbers of the tower's
 * rows in page order (the rows lifting out left out, as findTowerRows does) and says
 * whether they are what the wait is for. Only a full page counts, so a tower still being
 * drawn never passes. It runs in the browser, so it holds its own selectors.
 */
function areTheTowerRowsWhatTheWaitIsFor(waitedFor: TowerRowsWaitedFor): boolean {
  const tower = document.querySelector('[data-layer-id="tower"] > baja-graphic-positions-tower');
  const rows = tower?.shadowRoot?.querySelectorAll(
    '[data-testid="positions-tower-row"]:not(.is-leaving)',
  );
  const carOrderNow = [...(rows ?? [])].map((row) => row.getAttribute('data-car-number') ?? '');
  if (carOrderNow.length !== waitedFor.carOrder.length) {
    return false;
  }
  const isTheSameOrder = carOrderNow.join(',') === waitedFor.carOrder.join(',');
  return waitedFor.isWaitingToShowIt ? isTheSameOrder : !isTheSameOrder;
}

/**
 * Waits until the monitor draws a full page of rows in another order than the given one.
 * It waits for that to happen, not for a fixed time: the check runs inside the page at
 * every frame, so it sees the change the frame it is drawn, however slow the machine,
 * and only the test's own timeout ends the wait (BAJAOVRLAY-52).
 */
export async function waitUntilTheTowerRowsLeaveTheOrder(
  page: Page,
  carOrder: number[],
): Promise<void> {
  const monitorFrame = await findProgramMonitorFrame(page);
  const waitedFor: TowerRowsWaitedFor = {
    carOrder: carOrder.map(String),
    isWaitingToShowIt: false,
  };
  await monitorFrame.waitForFunction(areTheTowerRowsWhatTheWaitIsFor, waitedFor, {
    polling: 'raf',
  });
}

/**
 * Waits until the monitor draws a full page of rows in exactly the given order. Like
 * waitUntilTheTowerRowsLeaveTheOrder, it waits for the drawing, not for a fixed time; the
 * order given must be one that stays (data that no longer moves), or the wait could miss it.
 */
export async function waitUntilTheTowerRowsShowTheOrder(
  page: Page,
  carOrder: number[],
): Promise<void> {
  const monitorFrame = await findProgramMonitorFrame(page);
  const waitedFor: TowerRowsWaitedFor = {
    carOrder: carOrder.map(String),
    isWaitingToShowIt: true,
  };
  await monitorFrame.waitForFunction(areTheTowerRowsWhatTheWaitIsFor, waitedFor, {
    polling: 'raf',
  });
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
