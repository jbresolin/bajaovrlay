/**
 * The real race clock on the renderer's stage (apps/renderer, Playwright)
 *
 * What this module is for:
 *   This is the whole chain of milestone 0 in one smoke test: the real server (with a
 *   SQLite file of its own), the built race-clock package it serves, and the renderer
 *   page OBS loads. Everything on air comes from an item (BAJAOVRLAY-37), so a test
 *   prepares the race clock as an item with `createItem` and then sends `takeItem` for
 *   the id the server answered with, over the WebSocket, as the control page does. That
 *   take must end as a clock on the stage.
 *
 * What these tests prove:
 *   - After a takeItem of the race clock item, the clock is drawn inside the clock layer,
 *     at its Ardósia place on the 1920x1080 stage (top-right, inside the title-safe
 *     area), showing the data of the take, and it looks like its baseline screenshot.
 *   - After the page is reloaded (OBS refreshing its browser source) the clock is back
 *     without any new command, and its in-animation is skipped.
 *
 * What these tests deliberately do not cover:
 *   - The order and arguments of each lifecycle call; lifecycle.e2e.ts checks those with
 *     a fake graphic that writes them down.
 *   - The built renderer served by the server at /render/: the page comes from the Vite
 *     dev server, which forwards /ws, /api and /graphics to the real server.
 *   - Tidying the run's database: each take prepares a new item in "Sessão principal" of
 *     the run's own SQLite file, and nothing deletes it. The items pile up harmlessly
 *     there between local runs; CI starts from an empty file.
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

/** Turns the held enduro clock data into item fields, each value typed in (`literal`). */
function buildHeldEnduroClockItemFields(): Record<string, { kind: 'literal'; value: unknown }> {
  const fields: Record<string, { kind: 'literal'; value: unknown }> = {};
  for (const [fieldKey, value] of Object.entries(heldEnduroClockData)) {
    fields[fieldKey] = { kind: 'literal', value };
  }
  return fields;
}

/**
 * Prepares the held enduro clock as an item of "Sessão principal" on the clock layer,
 * then takes that item, as the control page does ("Salvar e disparar"), and resolves
 * with the server's answer to the take. Throws if the item could not be created, since
 * no take can follow then.
 */
async function takeHeldEnduroClockOnTheRealServer(): Promise<CommandAnswer> {
  const createAnswer = await sendCommandToRealServer({
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    layerId: 'clock',
    graphicId: 'race-clock',
    fields: buildHeldEnduroClockItemFields(),
    label: 'Relógio do enduro — parado em 1:05:00',
  });
  if (!createAnswer.ok || createAnswer.createdItemId === undefined) {
    throw new Error(
      `the real server did not create the clock item: ${JSON.stringify(createAnswer)}`,
    );
  }
  return sendCommandToRealServer({ type: 'takeItem', itemId: createAnswer.createdItemId });
}

// The two tests share one server and one clock layer, so they run one after the other.
// Neither relies on what the other left there: each clears the server and arranges its own.
test.describe.configure({ mode: 'serial' });

test.describe('the race clock taken on the real server', () => {
  test('shows the clock on the stage after a takeItem sent over the WebSocket', async ({
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

    // Act: prepare the race clock item and take it, as the control page does.
    const takeAnswer = await takeHeldEnduroClockOnTheRealServer();

    // Assert: the server accepted the take, and the clock is on the stage, inside the
    // clock layer, at its designed place, with the data of the take.
    const clockPanel = page
      .locator('[data-layer-id="clock"] > baja-graphic-race-clock')
      .getByTestId('race-clock-panel');
    expect(takeAnswer, 'the server must accept the takeItem command').toEqual({ ok: true });
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
    // Ardósia puts the clock top-right: 420 px wide, 96 px from the right edge of the
    // 1920 px stage (so x = 1920 - 96 - 420) and on the title-safe top at 54 px.
    const panelPlaceOnTheStage = await clockPanel.boundingBox();
    expect(
      { x: panelPlaceOnTheStage?.x, y: panelPlaceOnTheStage?.y },
      'the clock must sit at its designed place, 420 px wide at 96 px from the right and 54 px from the top',
    ).toEqual({ x: 1404, y: 54 });
  });

  test('brings the clock back after a page reload, without the in-animation', async ({ page }) => {
    // Arrange: the clock item was taken on the server before this page existed, so the page
    // stands in for OBS refreshing its browser source in the middle of the race.
    await clearEverythingOnTheRealServer();
    const takeAnswer = await takeHeldEnduroClockOnTheRealServer();
    expect(takeAnswer, 'the server must accept the takeItem that sets the scene').toEqual({
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
