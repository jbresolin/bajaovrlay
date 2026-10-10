/**
 * The real race clock on the renderer's stage (apps/renderer, Playwright)
 *
 * What this module is for:
 *   This is the whole chain of milestone 0 in one smoke test: the real server (with a
 *   SQLite file of its own), the built race-clock package it serves, and the renderer
 *   page OBS loads. A `takeGraphic` command sent over the WebSocket, as the control page
 *   will send it, must end as a clock on the stage.
 *
 * What these tests prove:
 *   - After a takeGraphic for the race clock, the clock is drawn inside the clock layer,
 *     at its place on the 1920x1080 stage, showing the data of the take, and it looks
 *     like its baseline screenshot.
 *   - After the page is reloaded (OBS refreshing its browser source) the clock is back
 *     without any new command, and its in-animation is skipped.
 *
 * What these tests deliberately do not cover:
 *   - The order and arguments of each lifecycle call; lifecycle.e2e.ts checks those with
 *     a fake graphic that writes them down.
 *   - The built renderer served by the server at /render/: the page comes from the Vite
 *     dev server, which forwards /ws, /api and /graphics to the real server.
 *   - Other operating systems: the baseline is rendered on Linux. After a deliberate
 *     visual change refresh it with
 *     `pnpm --filter @bajaovrlay/renderer test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

import { type CommandAnswer, sendCommandToRealServer } from './realServer.js';

/**
 * The enduro under green flag, held at 1:05:00 (running = false) so the time cannot move
 * between runs. The same data as the race clock's own green-flag screenshot.
 */
const heldEnduroClockData = {
  sessionName: 'Enduro de Resistência',
  state: 'green',
  clockMode: 'elapsed',
  referenceTimeMs: 3_900_000,
  referenceWallClockMs: Date.parse('2026-05-16T14:30:00.000Z'),
  running: false,
  lapsCompletedByLeader: 12,
};

/** Keeps the console lines in which the renderer logs that a playAction was answered. */
function collectPlayActionLogLines(page: Page): string[] {
  const playActionLogLines: string[] = [];
  page.on('console', (message) => {
    const line = message.text();
    const isAPlayAction =
      line.includes('"message":"graphic lifecycle call answered"') &&
      line.includes('"action":"playAction"');
    if (isAPlayAction) {
      playActionLogLines.push(line);
    }
  });
  return playActionLogLines;
}

/**
 * Clears everything on the real server (an earlier test or run may have left a clock on
 * air), so a test starts from a stage it arranged itself.
 */
async function clearEverythingOnTheRealServer(): Promise<void> {
  await sendCommandToRealServer({ type: 'clearAll' });
}

/**
 * Takes the held enduro clock on the clock layer, as the control page will, and resolves
 * with the server's answer.
 */
function takeHeldEnduroClockOnTheRealServer(): Promise<CommandAnswer> {
  return sendCommandToRealServer({
    type: 'takeGraphic',
    graphicId: 'race-clock',
    layerId: 'clock',
    data: heldEnduroClockData,
  });
}

// The two tests share one server and one clock layer, so they run one after the other.
// Neither relies on what the other left there: each clears the server and arranges its own.
test.describe.configure({ mode: 'serial' });

test.describe('the race clock taken on the real server', () => {
  test('shows the clock on the stage after a takeGraphic sent over the WebSocket', async ({
    page,
  }) => {
    // Arrange: nothing on air, and the renderer open.
    await clearEverythingOnTheRealServer();
    const playActionLogLines = collectPlayActionLogLines(page);
    await page.goto('/render/');
    await expect(
      page.locator('[data-layer-id="clock"]'),
      'the renderer must build the clock layer from the real server hello',
    ).toBeAttached();

    // Act: take the race clock on the clock layer, as the control page will.
    const takeAnswer = await takeHeldEnduroClockOnTheRealServer();

    // Assert: the server accepted the take, and the clock is on the stage, inside the
    // clock layer, at its designed place, with the data of the take.
    const clockPanel = page
      .locator('[data-layer-id="clock"] > baja-graphic-race-clock')
      .getByTestId('race-clock-panel');
    expect(takeAnswer, 'the server must accept the takeGraphic command').toEqual({ ok: true });
    await expect(clockPanel, 'the clock must be visible on the stage').toBeVisible();
    await expect(
      page.getByTestId('race-clock-time'),
      'the clock must show the held race time of the take',
    ).toHaveText('1:05:00');
    await expect
      .poll(() => playActionLogLines.length, { message: 'the clock must have been played' })
      .toBe(1);
    expect(playActionLogLines[0], 'a take must play the clock with its in-animation').not.toContain(
      '"skipAnimation":true',
    );
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    // A 1% pixel tolerance absorbs anti-aliasing differences between GPU drivers without
    // letting a colour or text change through. The screenshot is taken once the
    // in-animation has ended, so the panel is at rest at its place on the stage.
    await expect(clockPanel, 'the clock on the stage must look like its baseline').toHaveScreenshot(
      'race-clock-on-the-stage.png',
      { maxDiffPixelRatio: 0.01 },
    );
    const panelPlaceOnTheStage = await clockPanel.boundingBox();
    expect(
      { x: panelPlaceOnTheStage?.x, y: panelPlaceOnTheStage?.y },
      'the clock must sit at its designed place, 64 px from the left and 48 px from the top',
    ).toEqual({ x: 64, y: 48 });
  });

  test('brings the clock back after a page reload, without the in-animation', async ({ page }) => {
    // Arrange: the clock was taken on the server before this page existed, so the page
    // stands in for OBS refreshing its browser source in the middle of the race.
    await clearEverythingOnTheRealServer();
    const takeAnswer = await takeHeldEnduroClockOnTheRealServer();
    expect(takeAnswer, 'the server must accept the takeGraphic that sets the scene').toEqual({
      ok: true,
    });
    const playActionLogLines = collectPlayActionLogLines(page);

    // Act: open the renderer, sending no command at all.
    await page.goto('/render/');

    // Assert: the clock is back, and it was played with its animation skipped.
    await expect(
      page
        .locator('[data-layer-id="clock"] > baja-graphic-race-clock')
        .getByTestId('race-clock-panel'),
      'the clock must be rebuilt from what the server says is on air',
    ).toBeVisible();
    await expect(
      page.getByTestId('race-clock-time'),
      'the rebuilt clock must show the same held race time',
    ).toHaveText('1:05:00');
    await expect
      .poll(() => playActionLogLines.length, { message: 'the clock must have been played' })
      .toBe(1);
    expect(
      playActionLogLines[0],
      'a rebuilt clock must appear at once, without replaying its in-animation',
    ).toContain('"skipAnimation":true');
  });
});
